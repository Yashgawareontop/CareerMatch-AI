"use client"

import { useAuthToken } from "@convex-dev/auth/react"
import { useQuery } from "convex/react"
import Link from "next/link"
import { RefreshCwIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { AppShell } from "@/components/app-shell"
import { JobDrawer } from "@/components/jobs/job-drawer"
import { MatchCard } from "@/components/matches/match-card"
import { requestMatchRefresh } from "@/components/matches/request-refresh"
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignedOutState,
  WorkingState,
} from "@/components/states"
import { Button, buttonVariants } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

const SHOWN = 20

export default function MatchesPage() {
  const data = useQuery(api.matches.mine)
  const token = useAuthToken()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [openJob, setOpenJob] = useState<Id<"jobs"> | null>(null)
  const autoRefreshed = useRef(false)

  const running = busy || data?.latestRun?.status === "running"

  async function refresh() {
    setError(null)
    setBusy(true)
    const result = await requestMatchRefresh(token)
    setBusy(false)
    if (result.error) setError(result.error)
  }

  // Refresh once on open when the cached matches are out of date. Progress
  // shows through the live run status, so only an error is kept here.
  const shouldAutoRefresh =
    !!data && !!token && data.stale && data.latestRun?.status !== "running"
  useEffect(() => {
    if (!shouldAutoRefresh || autoRefreshed.current) return
    autoRefreshed.current = true
    void requestMatchRefresh(token).then((r) => {
      if (r.error) setError(r.error)
    })
  }, [shouldAutoRefresh, token])

  const matches = data?.matches ?? []
  const visible = showAll ? matches : matches.slice(0, SHOWN)

  return (
    <AppShell
      title="Matches"
      description={
        <>
          Ranked by how well each listing fits your skills and goals
          {data?.updatedAt && (
            <span className="font-mono text-xs tabular-nums">
              {" "}
              · updated{" "}
              {new Date(data.updatedAt).toLocaleString("en", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
        </>
      }
      actions={
        data?.hasAnalysis && (
          <Button variant="outline" disabled={running} onClick={refresh}>
            <RefreshCwIcon strokeWidth={1.5} aria-hidden />
            {running ? "Updating…" : "Refresh"}
          </Button>
        )
      }
    >
      {error && <ErrorState>{error}</ErrorState>}
      {data?.latestRun?.status === "failed" && !running && !error && (
        <ErrorState>
          {data.latestRun.error ?? "The last update failed."} Showing earlier
          results.
        </ErrorState>
      )}

      {data === undefined ? (
        <LoadingState label="Loading matches" />
      ) : !data.signedIn ? (
        <SignedOutState next="/matches" />
      ) : !data.hasAnalysis ? (
        <EmptyState
          title="No resume analysis yet"
          action={
            <Link href="/resume" className={buttonVariants({ size: "sm" })}>
              Upload your resume
            </Link>
          }
        >
          Upload and analyze your resume, then come back for matches.
        </EmptyState>
      ) : matches.length === 0 ? (
        running ? (
          <div className="flex flex-col gap-3">
            <WorkingState>
              Finding your matches. This takes about 10 to 20 seconds
            </WorkingState>
            <LoadingState rows={3} label="Finding matches" />
          </div>
        ) : (
          <EmptyState
            title="No matches yet"
            action={
              <Button size="sm" onClick={refresh}>
                Find matches
              </Button>
            }
          >
            We couldn&apos;t find matching listings. Try refreshing, or widen
            your preferences.
          </EmptyState>
        )
      ) : (
        <section aria-label="Matches" className="flex flex-col gap-4">
          {running && <WorkingState>Updating your matches</WorkingState>}
          {!data.explained && (
            <p className="text-xs text-muted-foreground">
              AI explanations were unavailable for this update, so reasons are
              based on your skills alone
            </p>
          )}
          {visible.map((match) => (
            <MatchCard
              key={match._id}
              match={match}
              onOpen={() => setOpenJob(match.jobId)}
            />
          ))}
          {!showAll && matches.length > SHOWN && (
            <Button variant="outline" onClick={() => setShowAll(true)}>
              Show {matches.length - SHOWN} more
            </Button>
          )}
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Your skills and goals are sent to Google Gemini and Groq to rank and
        explain matches
      </p>
      <JobDrawer jobId={openJob} onClose={() => setOpenJob(null)} />
    </AppShell>
  )
}
