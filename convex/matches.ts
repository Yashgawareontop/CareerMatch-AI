import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  action,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { limit } from "./rateLimits"
import schema, {
  feedbackStatusValidator,
  jobTypeValidator,
  matchFields,
  matchRunStatusValidator,
  seniorityValidator,
  skillValidator,
} from "./schema"
import { requireServerSecret, requireUserId } from "./serverAuth"

// Recommendations (Phase 5). Convex stores data and runs the vector search;
// the Next.js route app/api/matches/refresh embeds the profile, scores the
// candidates, asks the AI for explanations, and writes the result back here.

/** A refresh that has run this long is treated as crashed. */
const MATCH_TIMEOUT_MS = 3 * 60 * 1000
const MAX_MATCHES = 50
const MAX_DISMISSED = 500
const KEEP_RUNS = 10
const RECALL_LIMIT = 50
const FILTERED_RECALL_LIMIT = 30

const jobDoc = schema.doc("jobs")

async function latestRuns(ctx: QueryCtx, userId: Id<"users">, n: number) {
  return await ctx.db
    .query("matchRuns")
    .withIndex("by_userId_and_startedAt", (q) => q.eq("userId", userId))
    .order("desc")
    .take(n)
}

async function latestDoneAnalysis(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("analyses")
    .withIndex("by_userId_and_status", (q) =>
      q.eq("userId", userId).eq("status", "done")
    )
    .order("desc")
    .first()
}

// ── Refresh flow (called by app/api/matches/refresh) ────────

/**
 * Starts a refresh with the user's token: checks the rate limit, records a
 * "running" run, and returns what the route needs to build the profile.
 */
export const begin = mutation({
  args: {},
  returns: v.object({
    runId: v.id("matchRuns"),
    skills: v.array(skillValidator),
    seniority: seniorityValidator,
    inferredRoles: v.array(v.string()),
    summary: v.string(),
    careerGoals: v.object({
      targetRoles: v.array(v.string()),
      industries: v.array(v.string()),
      jobTypes: v.array(jobTypeValidator),
      locations: v.array(v.string()),
      statedGoal: v.optional(v.string()),
    }),
    preferences: v.union(
      v.null(),
      v.object({
        location: v.string(),
        preferredRoles: v.array(v.string()),
        jobTypes: v.array(jobTypeValidator),
        targetIndustries: v.array(v.string()),
      })
    ),
    dismissedJobIds: v.array(v.id("jobs")),
  }),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const analysis = await latestDoneAnalysis(ctx, userId)
    if (analysis === null || !analysis.result) {
      throw new ConvexError("Analyze your resume first")
    }

    const now = Date.now()
    const [latest] = await latestRuns(ctx, userId, 1)
    if (latest?.status === "running") {
      if (now - latest.startedAt < MATCH_TIMEOUT_MS) {
        throw new ConvexError("Already refreshing")
      }
      await ctx.db.patch("matchRuns", latest._id, {
        status: "failed",
        error: "Timed out",
      })
    }

    await limit(ctx, "matchRefresh", userId)

    const runId = await ctx.db.insert("matchRuns", {
      userId,
      status: "running",
      startedAt: now,
      analysisId: analysis._id,
      skillsEditedAt: analysis.skillsEditedAt,
    })

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique()
    const dismissed = await ctx.db
      .query("jobFeedback")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "dismissed")
      )
      .take(MAX_DISMISSED)

    const result = analysis.result
    return {
      runId,
      skills: analysis.skills ?? result.skills,
      seniority: result.seniority,
      inferredRoles: result.inferredRoles,
      summary: result.summary,
      careerGoals: result.careerGoals,
      preferences: profile
        ? {
            location: profile.location,
            preferredRoles: profile.preferredRoles,
            jobTypes: profile.jobTypes,
            targetIndustries: profile.targetIndustries,
          }
        : null,
      dismissedJobIds: dismissed.map((f) => f.jobId),
    }
  },
})

/**
 * Vector recall (server secret): the nearest jobs to a profile embedding.
 * One unfiltered search, plus one limited to the preferred job types so a
 * small group (e.g. internships) isn't crowded out. Merged by best score.
 */
export const recall = action({
  args: {
    secret: v.string(),
    embedding: v.array(v.float64()),
    jobTypes: v.array(jobTypeValidator),
  },
  returns: v.array(v.object({ job: jobDoc, similarity: v.number() })),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    if (args.embedding.length !== 768) throw new ConvexError("Bad embedding")

    const searches = [
      ctx.vectorSearch("jobEmbeddings", "by_embedding", {
        vector: args.embedding,
        limit: RECALL_LIMIT,
      }),
    ]
    const wanted = new Set(args.jobTypes)
    if (wanted.size > 0) {
      searches.push(
        ctx.vectorSearch("jobEmbeddings", "by_embedding", {
          vector: args.embedding,
          limit: FILTERED_RECALL_LIMIT,
          filter: (q) =>
            q.or(
              ...[...wanted].map((t) =>
                t === "remote" ? q.eq("remote", true) : q.eq("type", t)
              )
            ),
        })
      )
    }

    const best = new Map<Id<"jobEmbeddings">, number>()
    for (const hits of await Promise.all(searches)) {
      for (const hit of hits) {
        best.set(hit._id, Math.max(best.get(hit._id) ?? -1, hit._score))
      }
    }
    const ids = [...best.keys()]
    const jobs: (Doc<"jobs"> | null)[] = await ctx.runQuery(
      internal.matches.jobsForEmbeddings,
      { ids }
    )
    const out: { job: Doc<"jobs">; similarity: number }[] = []
    jobs.forEach((job, i) => {
      if (job) out.push({ job, similarity: best.get(ids[i]) ?? 0 })
    })
    return out.sort((a, b) => b.similarity - a.similarity)
  },
})

/** Hydrates vector hits into jobs, in the same order (null if deleted). */
export const jobsForEmbeddings = internalQuery({
  args: { ids: v.array(v.id("jobEmbeddings")) },
  returns: v.array(v.union(v.null(), jobDoc)),
  handler: async (ctx, args) => {
    return await Promise.all(
      args.ids.slice(0, 200).map(async (id) => {
        const row = await ctx.db.get("jobEmbeddings", id)
        return row ? await ctx.db.get("jobs", row.jobId) : null
      })
    )
  },
})

/** Replaces the user's matches with the new ranking (server secret). */
export const complete = mutation({
  args: {
    secret: v.string(),
    runId: v.id("matchRuns"),
    explained: v.boolean(),
    matches: v.array(v.object(matchFields)),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const run = await ctx.db.get("matchRuns", args.runId)
    if (run === null || run.status !== "running") return false
    const userId = run.userId

    for await (const old of ctx.db
      .query("matches")
      .withIndex("by_userId_and_rank", (q) => q.eq("userId", userId))) {
      await ctx.db.delete("matches", old._id)
    }
    for (const match of args.matches.slice(0, MAX_MATCHES)) {
      await ctx.db.insert("matches", { userId, runId: run._id, ...match })
    }

    await ctx.db.patch("matchRuns", run._id, {
      status: "done",
      completedAt: Date.now(),
      explained: args.explained,
      error: undefined,
    })
    await pruneRuns(ctx, userId)
    return true
  },
})

/** Records a failed refresh (server secret). Earlier matches stay. */
export const fail = mutation({
  args: { secret: v.string(), runId: v.id("matchRuns"), error: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const run = await ctx.db.get("matchRuns", args.runId)
    if (run === null || run.status !== "running") return false
    await ctx.db.patch("matchRuns", run._id, {
      status: "failed",
      error: args.error.slice(0, 500),
      completedAt: Date.now(),
    })
    return true
  },
})

async function pruneRuns(ctx: MutationCtx, userId: Id<"users">) {
  const old = await ctx.db
    .query("matchRuns")
    .withIndex("by_userId_and_startedAt", (q) => q.eq("userId", userId))
    .order("desc")
    .take(KEEP_RUNS + 20)
  for (const run of old.slice(KEEP_RUNS))
    await ctx.db.delete("matchRuns", run._id)
}

// ── Public reads and feedback ───────────────────────────────

const matchWithJob = v.object({
  _id: v.id("matches"),
  ...matchFields,
  job: jobDoc,
  feedback: v.union(v.null(), feedbackStatusValidator),
})

/**
 * The user's cached recommendations, plus whether they are out of date
 * (newer analysis, edited skills or preferences, or a newer job sync).
 */
export const mine = query({
  args: {},
  returns: v.object({
    signedIn: v.boolean(),
    hasAnalysis: v.boolean(),
    latestRun: v.union(
      v.null(),
      v.object({
        status: matchRunStatusValidator,
        startedAt: v.number(),
        error: v.optional(v.string()),
      })
    ),
    updatedAt: v.union(v.null(), v.number()),
    explained: v.boolean(),
    stale: v.boolean(),
    matches: v.array(matchWithJob),
  }),
  handler: async (ctx) => {
    const empty = {
      signedIn: false,
      hasAnalysis: false,
      latestRun: null,
      updatedAt: null,
      explained: false,
      stale: false,
      matches: [],
    }
    const userId = await requireUserIdOrNull(ctx)
    if (userId === null) return empty

    const analysis = await latestDoneAnalysis(ctx, userId)
    const runs = await latestRuns(ctx, userId, KEEP_RUNS)
    const latest = runs[0] ?? null
    const lastDone = runs.find((r) => r.status === "done") ?? null

    let stale = analysis !== null && lastDone === null
    if (analysis && lastDone) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique()
      const [lastSync] = await ctx.db
        .query("jobSyncRuns")
        .withIndex("by_startedAt")
        .order("desc")
        .take(1)
      stale =
        analysis._id !== lastDone.analysisId ||
        analysis.skillsEditedAt !== lastDone.skillsEditedAt ||
        (profile !== null && profile.updatedAt > lastDone.startedAt) ||
        (lastSync !== undefined && lastSync.finishedAt > lastDone.startedAt)
    }

    const rows = await ctx.db
      .query("matches")
      .withIndex("by_userId_and_rank", (q) => q.eq("userId", userId))
      .take(MAX_MATCHES)
    const matches = []
    for (const row of rows) {
      const job = await ctx.db.get("jobs", row.jobId)
      if (job === null) continue // expired since the refresh
      const feedback = await feedbackFor(ctx, userId, job._id)
      if (feedback?.status === "dismissed") continue
      matches.push({
        _id: row._id,
        jobId: row.jobId,
        rank: row.rank,
        score: row.score,
        semantic: row.semantic,
        skillOverlap: row.skillOverlap,
        preferenceFit: row.preferenceFit,
        agePenalty: row.agePenalty,
        matchedSkills: row.matchedSkills,
        missingSkills: row.missingSkills,
        reason: row.reason,
        job,
        feedback: feedback?.status ?? null,
      })
    }

    return {
      signedIn: true,
      hasAnalysis: analysis !== null,
      latestRun: latest
        ? {
            status: latest.status,
            startedAt: latest.startedAt,
            error: latest.error,
          }
        : null,
      updatedAt: lastDone?.completedAt ?? null,
      explained: lastDone?.explained ?? false,
      stale,
      matches,
    }
  },
})

function requireUserIdOrNull(ctx: QueryCtx) {
  return getAuthUserId<"users">(ctx)
}

async function feedbackFor(
  ctx: QueryCtx,
  userId: Id<"users">,
  jobId: Id<"jobs">
) {
  return await ctx.db
    .query("jobFeedback")
    .withIndex("by_userId_and_jobId", (q) =>
      q.eq("userId", userId).eq("jobId", jobId)
    )
    .unique()
}

/** The user's match for one job (if it is in their ranking) and feedback. */
export const forJob = query({
  args: { jobId: v.id("jobs") },
  returns: v.object({
    match: v.union(
      v.null(),
      v.object({ _id: v.id("matches"), ...matchFields })
    ),
    feedback: v.union(v.null(), feedbackStatusValidator),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserIdOrNull(ctx)
    if (userId === null) return { match: null, feedback: null }
    const rows = await ctx.db
      .query("matches")
      .withIndex("by_userId_and_rank", (q) => q.eq("userId", userId))
      .take(MAX_MATCHES)
    const row = rows.find((r) => r.jobId === args.jobId)
    const feedback = await feedbackFor(ctx, userId, args.jobId)
    return {
      match: row
        ? {
            _id: row._id,
            jobId: row.jobId,
            rank: row.rank,
            score: row.score,
            semantic: row.semantic,
            skillOverlap: row.skillOverlap,
            preferenceFit: row.preferenceFit,
            agePenalty: row.agePenalty,
            matchedSkills: row.matchedSkills,
            missingSkills: row.missingSkills,
            reason: row.reason,
          }
        : null,
      feedback: feedback?.status ?? null,
    }
  },
})

/** Saves, dismisses or marks a job as applied; `null` clears it. */
export const setFeedback = mutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(v.null(), feedbackStatusValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const existing = await feedbackFor(ctx, userId, args.jobId)
    if (args.status === null) {
      if (existing) await ctx.db.delete("jobFeedback", existing._id)
      return null
    }
    if ((await ctx.db.get("jobs", args.jobId)) === null) {
      throw new ConvexError("This listing is no longer available")
    }
    if (existing) {
      await ctx.db.patch("jobFeedback", existing._id, {
        status: args.status,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert("jobFeedback", {
        userId,
        jobId: args.jobId,
        status: args.status,
        updatedAt: Date.now(),
      })
    }
    return null
  },
})

/** The user's saved / applied / dismissed jobs, most recently added first. */
export const myFeedback = query({
  args: { status: feedbackStatusValidator },
  returns: v.array(
    v.object({
      status: feedbackStatusValidator,
      updatedAt: v.number(),
      job: v.union(v.null(), jobDoc),
      jobId: v.id("jobs"),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await requireUserIdOrNull(ctx)
    if (userId === null) return []
    const rows = await ctx.db
      .query("jobFeedback")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", args.status)
      )
      .order("desc")
      .take(100)
    return await Promise.all(
      rows.map(async (row) => ({
        status: row.status,
        updatedAt: row.updatedAt,
        jobId: row.jobId,
        job: await ctx.db.get("jobs", row.jobId),
      }))
    )
  },
})
