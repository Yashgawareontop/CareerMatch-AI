import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter"
import { ConvexError } from "convex/values"

import { components } from "./_generated/api"
import type { MutationCtx } from "./_generated/server"

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Upload URLs per user: bursts of 5, refilling to 20 per hour.
  resumeUpload: { kind: "token bucket", rate: 20, period: HOUR, capacity: 5 },
  // Parse attempts per user (a scanned PDF costs an AI call).
  resumeParse: {
    kind: "token bucket",
    rate: 10,
    period: 10 * MINUTE,
    capacity: 5,
  },
  // AI analyses per user: each one is a large prompt (plus retries).
  resumeAnalyze: { kind: "token bucket", rate: 10, period: HOUR, capacity: 3 },
  // Recommendation refreshes per user: an embedding plus one AI call each.
  matchRefresh: { kind: "token bucket", rate: 12, period: HOUR, capacity: 4 },
})

export type LimitName =
  "resumeUpload" | "resumeParse" | "resumeAnalyze" | "matchRefresh"

export const LIMIT_NAMES: LimitName[] = [
  "resumeUpload",
  "resumeParse",
  "resumeAnalyze",
  "matchRefresh",
]

/** Consumes one token for `key`, or throws a readable "Too many attempts" error. */
export async function limit(ctx: MutationCtx, name: LimitName, key: string) {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key })
  if (!ok) {
    const minutes = Math.max(1, Math.ceil(retryAfter / MINUTE))
    throw new ConvexError(
      `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
    )
  }
}
