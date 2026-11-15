import { v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import {
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server"
import { requireServerSecret } from "./serverAuth"

// AI call telemetry (Phase 7). The Next.js server records one row per
// request with the server secret; content is never stored.

const DAY = 24 * 60 * 60 * 1000
const RETENTION_MS = 30 * DAY
const PRUNE_BATCH = 500
/** Rows read for a usage summary; enough for a small app's busy week. */
const SUMMARY_SCAN = 5000

const callFields = {
  at: v.number(),
  provider: v.string(),
  model: v.string(),
  feature: v.string(),
  ms: v.number(),
  ok: v.boolean(),
  status: v.optional(v.number()),
  attempt: v.number(),
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
}

/** Records one AI request (server secret). */
export const record = mutation({
  args: { secret: v.string(), call: v.object(callFields) },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const c = args.call
    await ctx.db.insert("aiCalls", {
      ...c,
      provider: c.provider.slice(0, 40),
      model: c.model.slice(0, 120),
      feature: c.feature.slice(0, 40),
    })
    return null
  },
})

const bucket = v.object({
  key: v.string(),
  calls: v.number(),
  failed: v.number(),
  rateLimited: v.number(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  p50Ms: v.number(),
  p95Ms: v.number(),
})

export const usageSummaryValidator = v.object({
  since: v.number(),
  total: v.number(),
  truncated: v.boolean(),
  byModel: v.array(bucket),
  byFeature: v.array(bucket),
  byDay: v.array(bucket),
})

/** Calls since `since`, grouped by provider/model, by feature and by UTC day. */
export async function summarizeAICalls(ctx: QueryCtx, since: number) {
  const rows = await ctx.db
    .query("aiCalls")
    .withIndex("by_at", (q) => q.gte("at", since))
    .order("desc")
    .take(SUMMARY_SCAN)

  const group = (keyOf: (r: Doc<"aiCalls">) => string) => {
    const map = new Map<string, Doc<"aiCalls">[]>()
    for (const r of rows) {
      const k = keyOf(r)
      const list = map.get(k)
      if (list) list.push(r)
      else map.set(k, [r])
    }
    return [...map.entries()]
      .map(([key, list]) => {
        const ms = list.map((r) => r.ms).sort((a, b) => a - b)
        const pick = (p: number) =>
          ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] ?? 0
        return {
          key,
          calls: list.length,
          failed: list.filter((r) => !r.ok).length,
          rateLimited: list.filter((r) => r.status === 429).length,
          inputTokens: list.reduce((n, r) => n + (r.inputTokens ?? 0), 0),
          outputTokens: list.reduce((n, r) => n + (r.outputTokens ?? 0), 0),
          p50Ms: pick(0.5),
          p95Ms: pick(0.95),
        }
      })
      .sort((a, b) => b.calls - a.calls)
  }

  return {
    since,
    total: rows.length,
    truncated: rows.length === SUMMARY_SCAN,
    byModel: group((r) => `${r.provider}/${r.model}`),
    byFeature: group((r) => r.feature),
    byDay: group((r) => new Date(r.at).toISOString().slice(0, 10)).sort(
      (a, b) => b.key.localeCompare(a.key)
    ),
  }
}

/**
 * Usage since `since` (server secret), for scripts and ops tooling.
 * `since` is an argument because queries can't read the clock.
 */
export const summary = query({
  args: { secret: v.string(), since: v.number() },
  returns: usageSummaryValidator,
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    return await summarizeAICalls(ctx, args.since)
  },
})

/** Daily cron: deletes rows older than 30 days, in batches. */
export const prune = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const cutoff = (args.now ?? Date.now()) - RETENTION_MS
    const old = await ctx.db
      .query("aiCalls")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(PRUNE_BATCH)
    for (const row of old) await ctx.db.delete("aiCalls", row._id)
    // More left: continue in a fresh transaction.
    if (old.length === PRUNE_BATCH)
      await ctx.scheduler.runAfter(0, internal.aiCalls.prune, { now: args.now })
    return old.length
  },
})
