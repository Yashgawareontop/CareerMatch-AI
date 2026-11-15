"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { ArrowRightIcon, CheckIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { AppShell } from "@/components/app-shell"
import { SkillsChart } from "@/components/dashboard/skills-chart"
import { formatPosted } from "@/components/jobs/job-card"
import { JobDrawer } from "@/components/jobs/job-drawer"
import { MatchScore, pct } from "@/components/matches/match-score"
import {
  EmptyState,
  LoadingState,
  Panel,
  SignedOutState,
} from "@/components/states"
import { buttonVariants } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

const SENIORITY_LABEL = {
  student: "Student",
  intern: "Intern",
  junior: "Junior",
  mid: "Mid level",
  senior: "Senior",
} as const

const JOB_TYPE_LABEL: Record<string, string> = {
  internship: "Internship",
  "full-time": "Full-time",
  remote: "Remote",
}

export default function DashboardPage() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const skip = isAuthenticated ? {} : "skip"
  const profile = useQuery(api.profiles.getMine, skip)
  const resumes = useQuery(api.resumes.listMine, skip)
  const analysis = useQuery(api.analyses.latestDoneMine, skip)
  const matches = useQuery(api.matches.mine, skip)
  const [openJob, setOpenJob] = useState<Id<"jobs"> | null>(null)

  const loading =
    isLoading ||
    (isAuthenticated &&
      (profile === undefined ||
        resumes === undefined ||
        analysis === undefined ||
        matches === undefined))

  const skills = analysis
    ? (analysis.skills ?? analysis.result?.skills ?? [])
    : []
  const strong = skills.filter(
    (s) => s.level === "advanced" || s.level === "expert"
  ).length
  const matchList = matches?.matches ?? []

  return (
    <AppShell
      title="Dashboard"
      description={
        profile?.name
          ? `${profile.name}${profile.education ? ` · ${profile.education}` : ""}`
          : "Your profile, skills and best matches"
      }
      wide
    >
      {loading ? (
        <LoadingState rows={3} label="Loading dashboard" />
      ) : !isAuthenticated ? (
        <SignedOutState next="/dashboard" />
      ) : (
        <>
          <Checklist
            hasProfile={profile !== null}
            hasResume={(resumes ?? []).some((r) => r.status === "parsed")}
            hasAnalysis={analysis !== null}
            hasMatches={matchList.length > 0}
          />

          {analysis?.result && (
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Skills found" value={skills.length} />
              <Stat label="Advanced or expert" value={strong} />
              <Stat label="Ranked matches" value={matchList.length} />
              <Stat
                label="Best match"
                value={matchList[0] ? `${pct(matchList[0].score)}%` : "—"}
                accent={!!matchList[0]}
              />
            </dl>
          )}

          {analysis?.result ? (
            <>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <Panel
                  title="Top matches"
                  description={
                    matches?.stale ? (
                      <>
                        Out of date.{" "}
                        <Link
                          href="/matches"
                          className="text-foreground underline underline-offset-4"
                        >
                          Update them
                        </Link>
                      </>
                    ) : (
                      "Ranked by fit with your skills and goals"
                    )
                  }
                  action={
                    <Link
                      href="/matches"
                      className={buttonVariants({
                        size: "sm",
                        variant: "ghost",
                      })}
                    >
                      All matches
                      <ArrowRightIcon data-icon="inline-end" aria-hidden />
                    </Link>
                  }
                >
                  {matchList.length > 0 ? (
                    <ol className="-mx-2 flex flex-col">
                      {matchList.slice(0, 5).map((m) => (
                        <li key={m._id}>
                          <button
                            type="button"
                            onClick={() => setOpenJob(m.jobId)}
                            className="flex w-full items-center gap-4 rounded-lg px-2 py-3 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40"
                          >
                            <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                              {m.rank}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-sm font-medium">
                                {m.job.title}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {m.job.company} · {m.job.location} ·{" "}
                                {formatPosted(m.job.postedAt)}
                              </span>
                            </span>
                            <MatchScore score={m.score} size="sm" />
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No matches yet.{" "}
                      <Link
                        href="/matches"
                        className="text-foreground underline underline-offset-4"
                      >
                        Find your matches
                      </Link>
                    </p>
                  )}
                </Panel>

                <Panel
                  title="Profile summary"
                  action={
                    <Link
                      href={`/resume/${analysis.resumeId}`}
                      className={buttonVariants({
                        size: "sm",
                        variant: "ghost",
                      })}
                    >
                      Review
                    </Link>
                  }
                >
                  <p className="text-sm leading-6">{analysis.result.summary}</p>
                  <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 border-t pt-4 text-sm">
                    <dt className="text-muted-foreground">Level</dt>
                    <dd>{SENIORITY_LABEL[analysis.result.seniority]}</dd>
                    {analysis.result.careerGoals.jobTypes.length > 0 && (
                      <>
                        <dt className="text-muted-foreground">Looking for</dt>
                        <dd>
                          {analysis.result.careerGoals.jobTypes
                            .map((t) => JOB_TYPE_LABEL[t] ?? t)
                            .join(", ")}
                        </dd>
                      </>
                    )}
                    {analysis.result.careerGoals.targetRoles.length > 0 && (
                      <>
                        <dt className="text-muted-foreground">Roles</dt>
                        <dd>
                          {analysis.result.careerGoals.targetRoles
                            .slice(0, 5)
                            .join(", ")}
                        </dd>
                      </>
                    )}
                  </dl>
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <Panel
                  title="Skills by category"
                  description="Stacked by level, from your corrected list"
                >
                  <SkillsChart skills={skills} />
                </Panel>
                <div className="flex flex-col gap-4">
                  <Panel title="Strengths">
                    <List
                      items={analysis.result.strengths}
                      empty="No strengths noted"
                    />
                  </Panel>
                  <Panel title="Areas to grow">
                    <List items={analysis.result.gaps} empty="No gaps noted" />
                  </Panel>
                </div>
              </div>
            </>
          ) : null}

          {!analysis && !(resumes ?? []).length && (
            <EmptyState
              title="Start with your resume"
              action={
                <Link href="/resume" className={buttonVariants()}>
                  Upload resume
                </Link>
              }
            >
              We read your resume to find your skills and goals, then rank
              current internships and jobs for you.
            </EmptyState>
          )}
        </>
      )}
      <JobDrawer jobId={openJob} onClose={() => setOpenJob(null)} />
    </AppShell>
  )
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: React.ReactNode
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-card px-5 py-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono text-[28px] leading-none tabular-nums",
          accent && "text-brand"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="flex flex-col gap-2 text-sm leading-6">
      {items.slice(0, 5).map((item) => (
        <li key={item} className="flex gap-2.5">
          <span
            className="mt-2.5 size-1 shrink-0 rounded-full bg-muted-foreground"
            aria-hidden
          />
          {item}
        </li>
      ))}
    </ul>
  )
}

/** Getting-started steps; hidden once everything is done. */
function Checklist(props: {
  hasProfile: boolean
  hasResume: boolean
  hasAnalysis: boolean
  hasMatches: boolean
}) {
  const steps = [
    {
      done: props.hasProfile,
      label: "Set your career preferences",
      href: "/onboarding",
    },
    { done: props.hasResume, label: "Upload your resume", href: "/resume" },
    {
      done: props.hasAnalysis,
      label: "Review your extracted skills",
      href: "/resume",
    },
    { done: props.hasMatches, label: "See your matches", href: "/matches" },
  ]
  if (steps.every((s) => s.done)) return null
  const next = steps.find((s) => !s.done)
  const doneCount = steps.filter((s) => s.done).length

  return (
    <Panel
      aria-label="Getting started"
      title="Get started"
      description={`${doneCount} of ${steps.length} done`}
      action={
        next && (
          <Link href={next.href} className={buttonVariants({ size: "sm" })}>
            {next.label}
          </Link>
        )
      }
    >
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className={cn(
                "flex h-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/60",
                s === next && "border-foreground/20 bg-muted/40 font-medium",
                s.done && "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums",
                  s.done && "border-transparent bg-foreground text-background"
                )}
                aria-hidden
              >
                {s.done ? (
                  <CheckIcon className="size-3" strokeWidth={2} />
                ) : (
                  i + 1
                )}
              </span>
              <span className="sr-only">{s.done ? "Done:" : "To do:"}</span>
              {s.label}
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
