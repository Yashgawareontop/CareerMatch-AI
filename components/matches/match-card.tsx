"use client"

import type { FunctionReturnType } from "convex/server"

import { FeedbackButtons } from "@/components/jobs/feedback-buttons"
import { JobCard } from "@/components/jobs/job-card"
import { api } from "@/convex/_generated/api"

import { MatchScore, pct, SkillWords } from "./match-score"

export type MatchItem = FunctionReturnType<
  typeof api.matches.mine
>["matches"][number]

/** A ranked match: the listing, why it fits, skills, and feedback buttons. */
export function MatchCard({
  match,
  onOpen,
}: {
  match: MatchItem
  onOpen: () => void
}) {
  return (
    <JobCard
      job={match.job}
      onOpen={onOpen}
      aside={<MatchScore score={match.score} />}
    >
      <div className="flex flex-col gap-3 border-t pt-4">
        {match.reason && <p className="text-sm leading-6">{match.reason}</p>}
        <SkillWords
          matched={match.matchedSkills}
          missing={match.missingSkills}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FeedbackButtons jobId={match.jobId} feedback={match.feedback} />
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            #{match.rank} · meaning {pct(match.semantic)}% · skills{" "}
            {pct(match.skillOverlap)}% · fit {pct(match.preferenceFit)}%
          </p>
        </div>
      </div>
    </JobCard>
  )
}
