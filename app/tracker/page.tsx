"use client"

import { useMutation, useQuery } from "convex/react"
import Link from "next/link"
import { useState } from "react"

import { AppShell } from "@/components/app-shell"
import {
  FeedbackButtons,
  type Feedback,
} from "@/components/jobs/feedback-buttons"
import { JobCard } from "@/components/jobs/job-card"
import { JobDrawer } from "@/components/jobs/job-drawer"
import { EmptyState, LoadingState } from "@/components/states"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

const TABS: { value: Feedback; label: string; empty: string }[] = [
  {
    value: "saved",
    label: "Saved",
    empty: "Save jobs from your matches or the job list to keep them here",
  },
  {
    value: "applied",
    label: "Applied",
    empty: "Mark jobs as applied to track your applications",
  },
  {
    value: "dismissed",
    label: "Hidden",
    empty:
      "Jobs you mark “Not interested” are hidden from your matches and listed here",
  },
]

export default function TrackerPage() {
  const [tab, setTab] = useState<Feedback>("saved")
  const [openJob, setOpenJob] = useState<Id<"jobs"> | null>(null)

  return (
    <AppShell title="Tracker" description="Jobs you saved, applied to or hid">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Feedback)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="pt-4">
            {tab === t.value && (
              <FeedbackList
                status={t.value}
                empty={t.empty}
                onOpen={setOpenJob}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
      <JobDrawer jobId={openJob} onClose={() => setOpenJob(null)} />
    </AppShell>
  )
}

function FeedbackList({
  status,
  empty,
  onOpen,
}: {
  status: Feedback
  empty: string
  onOpen: (id: Id<"jobs">) => void
}) {
  const rows = useQuery(api.matches.myFeedback, { status })

  if (rows === undefined) return <LoadingState label="Loading tracker" />
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        action={
          <Link href="/matches" className={buttonVariants()}>
            See your matches
          </Link>
        }
      >
        {empty}
      </EmptyState>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.jobId}>
          {row.job ? (
            <JobCard job={row.job} onOpen={() => onOpen(row.jobId)}>
              <p className="font-mono text-xs text-muted-foreground tabular-nums">
                {status === "applied" ? "Applied" : "Updated"}{" "}
                {new Date(row.updatedAt).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <FeedbackButtons jobId={row.jobId} feedback={row.status} />
            </JobCard>
          ) : (
            <ExpiredRow jobId={row.jobId} />
          )}
        </li>
      ))}
    </ul>
  )
}

/** A tracked job whose listing has expired; it can still be removed. */
function ExpiredRow({ jobId }: { jobId: Id<"jobs"> }) {
  const setFeedback = useMutation(api.matches.setFeedback)
  const [pending, setPending] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed p-4">
      <p className="text-sm text-muted-foreground">This listing has expired</p>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          await setFeedback({ jobId, status: null }).finally(() =>
            setPending(false)
          )
        }}
      >
        Remove
      </Button>
    </div>
  )
}
