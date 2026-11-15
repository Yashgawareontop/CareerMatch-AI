import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

import { env, query } from "./_generated/server"
import { summarizeAICalls, usageSummaryValidator } from "./aiCalls"
import { LIMIT_NAMES, rateLimiter } from "./rateLimits"

// Quota usage for /usage (Phase 7).

const limitName = v.union(
  v.literal("resumeUpload"),
  v.literal("resumeParse"),
  v.literal("resumeAnalyze"),
  v.literal("matchRefresh")
)

/**
 * The signed-in user's rate-limit buckets, without consuming anything. The
 * client turns `value`/`ts` into tokens available now (queries can't read
 * the clock), using the same refill math as the limiter.
 */
export const myLimits = query({
  args: {},
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        name: limitName,
        /** Tokens left at `ts`. A never-used key reports a full bucket at ts 0. */
        value: v.number(),
        ts: v.number(),
        rate: v.number(),
        period: v.number(),
        capacity: v.number(),
      })
    )
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId<"users">(ctx)
    if (userId === null) return null
    return await Promise.all(
      LIMIT_NAMES.map(async (name) => {
        const { config, value, ts } = await rateLimiter.getValue(ctx, name, {
          key: userId,
        })
        return {
          name,
          value,
          ts,
          rate: config.rate,
          period: config.period,
          capacity: config.capacity ?? config.rate,
        }
      })
    )
  },
})

function isAdmin(userId: string) {
  return (env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId)
}

/** Service-wide AI usage, for user ids in ADMIN_USER_IDS. Null for others. */
export const service = query({
  args: { since: v.number() },
  returns: v.union(v.null(), usageSummaryValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId<"users">(ctx)
    if (userId === null || !isAdmin(userId)) return null
    return await summarizeAICalls(ctx, args.since)
  },
})
