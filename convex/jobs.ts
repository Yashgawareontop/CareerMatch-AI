import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { internalQuery, mutation, query } from "./_generated/server"
import schema, {
  jobFields,
  jobKindValidator,
  jobLevelValidator,
  jobSourceValidator,
  syncSourceStatValidator,
} from "./schema"
import { requireServerSecret } from "./serverAuth"

// Job listings. The Next.js sync route (app/api/jobs/sync) fetches the
// sources and writes here with the server secret; browsers only read.

const DAY = 24 * 60 * 60 * 1000
/** Listings posted longer ago than this are deleted. */
export const MAX_JOB_AGE_MS = 30 * DAY
/** A listing a source stops returning is deleted after this grace period. */
const NOT_SEEN_GRACE_MS = 2 * DAY
const MAX_BATCH = 100
const DELETE_BATCH = 200

const incomingJob = v.object({ ...jobFields, dedupeKey: v.string() })

// ── Server-only (sync route) ────────────────────────────────

/**
 * Which of these (source, externalId) pairs are already stored, with their
 * level (so the sync only sends new or still-"unknown" listings to the AI).
 */
export const knownIds = query({
  args: {
    secret: v.string(),
    items: v.array(
      v.object({ source: jobSourceValidator, externalId: v.string() })
    ),
  },
  returns: v.array(v.object({ id: v.string(), level: jobLevelValidator })),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const items = args.items.slice(0, 500)
    const rows = await Promise.all(
      items.map((item) =>
        ctx.db
          .query("jobs")
          .withIndex("by_source_and_externalId", (q) =>
            q.eq("source", item.source).eq("externalId", item.externalId)
          )
          .unique()
      )
    )
    return rows
      .filter((r) => r !== null)
      .map((r) => ({ id: `${r.source}:${r.externalId}`, level: r.level }))
  },
})

/**
 * Inserts new listings and refreshes known ones. A listing whose title +
 * company hash matches a row from another source counts as a duplicate: it
 * only refreshes that row's `lastSeenAt`.
 */
export const upsertBatch = mutation({
  args: { secret: v.string(), jobs: v.array(incomingJob) },
  returns: v.object({
    inserted: v.number(),
    updated: v.number(),
    duplicates: v.number(),
  }),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const now = Date.now()
    let inserted = 0
    let updated = 0
    let duplicates = 0

    for (const job of args.jobs.slice(0, MAX_BATCH)) {
      const existing = await ctx.db
        .query("jobs")
        .withIndex("by_source_and_externalId", (q) =>
          q.eq("source", job.source).eq("externalId", job.externalId)
        )
        .unique()
      if (existing) {
        await ctx.db.patch("jobs", existing._id, {
          ...job,
          // Keep an AI-assigned level when the rules couldn't decide this time.
          level: job.level === "unknown" ? existing.level : job.level,
          lastSeenAt: now,
        })
        // Keep the vector-search filter copies in step with the job.
        if (existing.type !== job.type || existing.remote !== job.remote) {
          const vector = await ctx.db
            .query("jobEmbeddings")
            .withIndex("by_jobId", (q) => q.eq("jobId", existing._id))
            .unique()
          if (vector)
            await ctx.db.patch("jobEmbeddings", vector._id, {
              type: job.type,
              remote: job.remote,
            })
        }
        updated++
        continue
      }

      const twin = await ctx.db
        .query("jobs")
        .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", job.dedupeKey))
        .first()
      if (twin) {
        await ctx.db.patch("jobs", twin._id, { lastSeenAt: now })
        duplicates++
        continue
      }

      await ctx.db.insert("jobs", { ...job, firstSeenAt: now, lastSeenAt: now })
      inserted++
    }
    return { inserted, updated, duplicates }
  },
})

/**
 * Deletes one batch of expired listings: posted more than 30 days ago, or
 * (for sources that synced successfully in this run) not returned for 2 days.
 * Call until `more` is false.
 */
export const expireBatch = mutation({
  args: {
    secret: v.string(),
    syncedSources: v.array(jobSourceValidator),
  },
  returns: v.object({ deleted: v.number(), more: v.boolean() }),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const now = Date.now()
    const ids = new Set<Id<"jobs">>()

    const old = await ctx.db
      .query("jobs")
      .withIndex("by_postedAt", (q) => q.lt("postedAt", now - MAX_JOB_AGE_MS))
      .take(DELETE_BATCH)
    for (const row of old) ids.add(row._id)

    for (const source of args.syncedSources) {
      if (ids.size >= DELETE_BATCH) break
      const stale = await ctx.db
        .query("jobs")
        .withIndex("by_source_and_lastSeenAt", (q) =>
          q.eq("source", source).lt("lastSeenAt", now - NOT_SEEN_GRACE_MS)
        )
        .take(DELETE_BATCH - ids.size)
      for (const row of stale) ids.add(row._id)
    }

    for (const id of ids) {
      const vector = await ctx.db
        .query("jobEmbeddings")
        .withIndex("by_jobId", (q) => q.eq("jobId", id))
        .unique()
      if (vector) await ctx.db.delete("jobEmbeddings", vector._id)
      await ctx.db.delete("jobs", id)
    }
    return { deleted: ids.size, more: ids.size >= DELETE_BATCH }
  },
})

const MAX_EMBED_BATCH = 100

/** Listings that have no embedding yet (the sync embeds them, Phase 5). */
export const pendingEmbeddings = query({
  args: { secret: v.string(), limit: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("jobs"),
      title: v.string(),
      company: v.string(),
      location: v.string(),
      type: jobKindValidator,
      level: jobLevelValidator,
      remote: v.boolean(),
      skills: v.array(v.string()),
      description: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const n = Math.min(Math.max(Math.floor(args.limit), 1), MAX_EMBED_BATCH)
    const rows = await ctx.db
      .query("jobs")
      .withIndex("by_embeddedAt", (q) => q.eq("embeddedAt", undefined))
      .take(n)
    return rows.map((r) => ({
      _id: r._id,
      title: r.title,
      company: r.company,
      location: r.location,
      type: r.type,
      level: r.level,
      remote: r.remote,
      skills: r.skills,
      description: r.description,
    }))
  },
})

/** Stores job embeddings (replacing any earlier one). Skips deleted jobs. */
export const setEmbeddings = mutation({
  args: {
    secret: v.string(),
    model: v.string(),
    items: v.array(
      v.object({ jobId: v.id("jobs"), embedding: v.array(v.float64()) })
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const now = Date.now()
    let stored = 0
    for (const item of args.items.slice(0, MAX_EMBED_BATCH)) {
      if (item.embedding.length !== 768) continue
      const job = await ctx.db.get("jobs", item.jobId)
      if (job === null) continue
      const existing = await ctx.db
        .query("jobEmbeddings")
        .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
        .unique()
      const row = {
        jobId: job._id,
        embedding: item.embedding,
        model: args.model,
        type: job.type,
        remote: job.remote,
      }
      if (existing) await ctx.db.replace("jobEmbeddings", existing._id, row)
      else await ctx.db.insert("jobEmbeddings", row)
      await ctx.db.patch("jobs", job._id, { embeddedAt: now })
      stored++
    }
    return stored
  },
})

/** Logs one sync run (call counts per source, for the free quotas). */
export const recordRun = mutation({
  args: {
    secret: v.string(),
    run: v.object({
      startedAt: v.number(),
      finishedAt: v.number(),
      sources: v.array(syncSourceStatValidator),
      inserted: v.number(),
      updated: v.number(),
      duplicates: v.number(),
      expired: v.number(),
      aiCalls: v.number(),
      embedded: v.optional(v.number()),
      embedCalls: v.optional(v.number()),
      error: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    await ctx.db.insert("jobSyncRuns", args.run)
    return null
  },
})

/** The latest sync runs, newest first (the route uses it as a cooldown). */
export const recentRuns = query({
  args: { secret: v.string(), limit: v.optional(v.number()) },
  returns: v.array(schema.doc("jobSyncRuns")),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const n = Math.min(Math.max(args.limit ?? 1, 1), 50)
    return await ctx.db
      .query("jobSyncRuns")
      .withIndex("by_startedAt")
      .order("desc")
      .take(n)
  },
})

/**
 * Public: when listings were last refreshed and which sources failed in that
 * run, so the job list can say results may be partial. Source names only,
 * never error details.
 */
export const lastSync = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      finishedAt: v.number(),
      failedSources: v.array(jobSourceValidator),
    })
  ),
  handler: async (ctx) => {
    const run = await ctx.db
      .query("jobSyncRuns")
      .withIndex("by_startedAt")
      .order("desc")
      .first()
    if (run === null) return null
    return {
      finishedAt: run.finishedAt,
      failedSources: run.sources.filter((s) => s.error).map((s) => s.source),
    }
  },
})

/** Admin check: active listings per source. `npx convex run jobs:countBySource` */
export const countBySource = internalQuery({
  args: {},
  returns: v.record(v.string(), v.number()),
  handler: async (ctx) => {
    const counts: Record<string, number> = {}
    for await (const row of ctx.db.query("jobs")) {
      counts[row.source] = (counts[row.source] ?? 0) + 1
      counts.total = (counts.total ?? 0) + 1
    }
    return counts
  },
})

// ── Public reads ────────────────────────────────────────────

const jobDoc = schema.doc("jobs")

/** Newest listings, optionally of one type. */
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(jobKindValidator),
  },
  handler: async (ctx, args) => {
    const type = args.type
    const q = type
      ? ctx.db
          .query("jobs")
          .withIndex("by_type_and_postedAt", (q) => q.eq("type", type))
      : ctx.db.query("jobs").withIndex("by_postedAt")
    return await q.order("desc").paginate(args.paginationOpts)
  },
})

/**
 * Newest listings with filters. `postedAfter` comes from the client (queries
 * can't read the clock); type and date use the index, while remote and
 * location filter each page, so a page can hold fewer than requested.
 */
export const browse = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(jobKindValidator),
    remote: v.optional(v.boolean()),
    location: v.optional(v.string()),
    postedAfter: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const after = args.postedAfter ?? 0
    const type = args.type
    const q = type
      ? ctx.db
          .query("jobs")
          .withIndex("by_type_and_postedAt", (q) =>
            q.eq("type", type).gt("postedAt", after)
          )
      : ctx.db
          .query("jobs")
          .withIndex("by_postedAt", (q) => q.gt("postedAt", after))
    const result = await q.order("desc").paginate(args.paginationOpts)
    const where = args.location?.trim().toLowerCase().slice(0, 100)
    return {
      ...result,
      page: result.page.filter(
        (job) =>
          (args.remote === undefined || job.remote === args.remote) &&
          (!where || job.location.toLowerCase().includes(where))
      ),
    }
  },
})

/** One listing, or null if it has expired. */
export const get = query({
  args: { jobId: v.string() },
  returns: v.union(v.null(), jobDoc),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("jobs", args.jobId)
    return id ? await ctx.db.get("jobs", id) : null
  },
})

/** Full-text search on titles, then descriptions (deduplicated). */
export const search = query({
  args: {
    text: v.string(),
    type: v.optional(jobKindValidator),
    remote: v.optional(v.boolean()),
  },
  returns: v.array(jobDoc),
  handler: async (ctx, args) => {
    const text = args.text.trim().slice(0, 200)
    if (!text) return []
    const run = (
      index: "search_title" | "search_description",
      field: "title" | "description"
    ) =>
      ctx.db
        .query("jobs")
        .withSearchIndex(index, (q) => {
          let s = q.search(field, text)
          if (args.type) s = s.eq("type", args.type)
          if (args.remote !== undefined) s = s.eq("remote", args.remote)
          return s
        })
        .take(30)
    const [byTitle, byDescription] = await Promise.all([
      run("search_title", "title"),
      run("search_description", "description"),
    ])
    const seen = new Set<string>()
    return [...byTitle, ...byDescription].filter((job) => {
      if (seen.has(job._id)) return false
      seen.add(job._id)
      return true
    })
  },
})
