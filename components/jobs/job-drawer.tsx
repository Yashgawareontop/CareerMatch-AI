"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { ExternalLinkIcon } from "lucide-react"

import { MatchScore, SkillWords } from "@/components/matches/match-score"
import { LoadingState } from "@/components/states"
import { buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

import { FeedbackButtons } from "./feedback-buttons"
import { formatPosted, JobTags } from "./job-card"
import { SourceCredit } from "./source-credit"

/** Detail drawer for one listing: match explanation, feedback, description. */
export function JobDrawer({
  jobId,
  onClose,
}: {
  jobId: Id<"jobs"> | null
  onClose: () => void
}) {
  return (
    <Sheet open={jobId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {jobId && <DrawerBody jobId={jobId} />}
      </SheetContent>
    </Sheet>
  )
}

function DrawerBody({ jobId }: { jobId: Id<"jobs"> }) {
  const { isAuthenticated } = useConvexAuth()
  const job = useQuery(api.jobs.get, { jobId })
  const mine = useQuery(
    api.matches.forJob,
    isAuthenticated ? { jobId } : "skip"
  )

  if (job === undefined) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Loading listing…</SheetTitle>
        </SheetHeader>
        <LoadingState rows={2} className="px-4" />
      </>
    )
  }
  if (job === null) {
    return (
      <SheetHeader>
        <SheetTitle>Listing no longer available</SheetTitle>
        <SheetDescription>
          This job has expired or was removed by its source.
        </SheetDescription>
      </SheetHeader>
    )
  }

  const match = mine?.match ?? null
  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-8">{job.title}</SheetTitle>
        <SheetDescription>
          {job.company} · {job.location} · posted {formatPosted(job.postedAt)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 px-4 pb-8">
        <JobTags job={job} />

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants()}
          >
            View and apply
            <ExternalLinkIcon aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <SourceCredit source={job.source} />
        </div>

        {isAuthenticated && (
          <FeedbackButtons jobId={job._id} feedback={mine?.feedback ?? null} />
        )}

        {match ? (
          <section
            aria-label="Why this matches you"
            className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-medium">Why it fits you</h2>
                <p className="font-mono text-xs text-muted-foreground tabular-nums">
                  #{match.rank} of your matches
                </p>
              </div>
              <MatchScore score={match.score} />
            </div>
            {match.reason && (
              <p className="text-sm leading-6">{match.reason}</p>
            )}
            <SkillWords
              matched={match.matchedSkills}
              missing={match.missingSkills}
              limit={20}
            />
          </section>
        ) : (
          isAuthenticated &&
          mine !== undefined && (
            <p className="text-sm text-muted-foreground">
              Not in your top matches. Refresh your matches to see how it
              compares
            </p>
          )
        )}

        {job.skills.length > 0 && (
          <section className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Skills in this listing</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {job.skills.join(" · ")}
            </p>
          </section>
        )}

        <section className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Description</h2>
          <p className="text-sm leading-6 whitespace-pre-line text-muted-foreground">
            {job.description}
          </p>
        </section>
      </div>
    </>
  )
}
