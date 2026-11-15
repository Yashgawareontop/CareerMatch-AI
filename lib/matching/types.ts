import type { FunctionReturnType } from "convex/server"
import type { Infer } from "convex/values"

import type { api } from "@/convex/_generated/api"
import type { matchValidator } from "@/convex/schema"

/** What `matches.begin` returns: the user's skills, goals and preferences. */
export type MatchProfile = Omit<
  FunctionReturnType<typeof api.matches.begin>,
  "runId" | "dismissedJobIds"
>

/** A recall candidate: a job and its cosine similarity to the profile. */
export type Candidate = FunctionReturnType<typeof api.matches.recall>[number]

/** One stored recommendation (`matchFields` in convex/schema.ts). */
export type ScoredMatch = Infer<typeof matchValidator>
