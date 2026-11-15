import "server-only"

import { fetchAction, fetchMutation } from "convex/nextjs"

import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { embed } from "@/lib/ai"

import { EXPLAIN_TOP, explainMatches, ruleReason } from "./explain"
import { rankCandidates } from "./score"
import { profileEmbeddingText, profileJobTypes } from "./text"
import type { MatchProfile } from "./types"

export { embedPendingJobs, type EmbedJobsResult } from "./embed-jobs"
export type { Candidate, MatchProfile, ScoredMatch } from "./types"

export interface RefreshOutput {
  matches: number
  explained: boolean
  provider: string | null
  candidates: number
}

/**
 * Computes and stores a user's recommendations for a run started with
 * `matches.begin`: embed the profile, vector recall in Convex, score, explain
 * the top 10, write back. `secret` is RESUME_PARSER_SECRET.
 */
export async function computeMatches(
  secret: string,
  runId: Id<"matchRuns">,
  profile: MatchProfile,
  dismissedJobIds: Id<"jobs">[]
): Promise<RefreshOutput> {
  const [vector] = await embed([profileEmbeddingText(profile)], "query")
  const candidates = await fetchAction(api.matches.recall, {
    secret,
    embedding: vector,
    jobTypes: profileJobTypes(profile),
  })

  const ranked = rankCandidates(candidates, profile, {
    now: Date.now(),
    dismissed: dismissedJobIds,
  })
  const jobs = new Map<string, Doc<"jobs">>(
    candidates.map((c) => [c.job._id, c.job])
  )
  const top = ranked
    .slice(0, EXPLAIN_TOP)
    .map((match) => ({ match, job: jobs.get(match.jobId)! }))

  const ai = await explainMatches(profile, top)
  const matches = ranked.map((match, i) => {
    if (i >= EXPLAIN_TOP) return match
    const explanation = ai?.explanations.get(i)
    return explanation
      ? {
          ...match,
          reason: explanation.reason,
          missingSkills:
            explanation.missingSkills.length > 0
              ? explanation.missingSkills
              : match.missingSkills,
        }
      : { ...match, reason: ruleReason(match, top[i].job) }
  })

  await fetchMutation(api.matches.complete, {
    secret,
    runId,
    explained: ai !== null,
    matches,
  })
  return {
    matches: matches.length,
    explained: ai !== null,
    provider: ai?.provider ?? null,
    candidates: candidates.length,
  }
}
