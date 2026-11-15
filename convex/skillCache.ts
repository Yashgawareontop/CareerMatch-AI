import { v } from "convex/values"

import { mutation, query } from "./_generated/server"
import { requireServerSecret } from "./serverAuth"

// Cache of ESCO skill-name lookups made by the analyze route. Only the
// Next.js server (server secret) reads or writes it.

const MAX_KEYS = 100
const MAX_FIELD = 200

/** Cached lookups for these keys (from skillKey). Missing keys aren't cached. */
export const lookup = query({
  args: { secret: v.string(), keys: v.array(v.string()) },
  returns: v.array(
    v.object({
      key: v.string(),
      canonical: v.union(v.null(), v.string()),
      escoUri: v.union(v.null(), v.string()),
    })
  ),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const keys = [...new Set(args.keys)].slice(0, MAX_KEYS)
    const rows = await Promise.all(
      keys.map((key) =>
        ctx.db
          .query("skillCache")
          .withIndex("by_key", (q) => q.eq("key", key))
          .unique()
      )
    )
    return rows
      .filter((r) => r !== null)
      .map((r) => ({
        key: r.key,
        canonical: r.canonical ?? null,
        escoUri: r.escoUri ?? null,
      }))
  },
})

/** Stores ESCO lookup results. `canonical: null` records "no close match". */
export const remember = mutation({
  args: {
    secret: v.string(),
    entries: v.array(
      v.object({
        key: v.string(),
        canonical: v.union(v.null(), v.string()),
        escoUri: v.union(v.null(), v.string()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const now = Date.now()
    for (const entry of args.entries.slice(0, MAX_KEYS)) {
      const key = entry.key.slice(0, MAX_FIELD)
      if (key.length === 0) continue
      const doc = {
        key,
        canonical: entry.canonical?.slice(0, MAX_FIELD) ?? undefined,
        escoUri: entry.escoUri?.slice(0, MAX_FIELD) ?? undefined,
        checkedAt: now,
      }
      const existing = await ctx.db
        .query("skillCache")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique()
      if (existing) await ctx.db.replace("skillCache", existing._id, doc)
      else await ctx.db.insert("skillCache", doc)
    }
    return null
  },
})
