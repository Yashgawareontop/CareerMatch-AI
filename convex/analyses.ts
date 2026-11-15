import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError, v, type Infer } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { limit } from "./rateLimits"
import { ANALYSIS_TIMEOUT_MS } from "./resumeLimits"
import schema, {
  analysisResultValidator,
  analysisStatusValidator,
  jobTypeValidator,
  skillValidator,
} from "./schema"
import { requireServerSecret, requireUserId } from "./serverAuth"
import {
  aliasFor,
  MAX_SKILL_EVIDENCE,
  MAX_SKILLS,
  skillKey,
  tidySkillName,
} from "./skillNames"

const HISTORY_LIMIT = 10
const MAX_PROMPT_VERSION = 40

/** Loads an analysis and checks that the signed-in user owns it. */
async function requireOwnAnalysis(ctx: QueryCtx, analysisId: Id<"analyses">) {
  const userId = await requireUserId(ctx)
  const analysis = await ctx.db.get("analyses", analysisId)
  if (analysis === null || analysis.userId !== userId) {
    throw new ConvexError("Analysis not found")
  }
  return analysis
}

async function latestForResume(ctx: QueryCtx, resumeId: Id<"resumes">) {
  return await ctx.db
    .query("analyses")
    .withIndex("by_resumeId", (q) => q.eq("resumeId", resumeId))
    .order("desc")
    .first()
}

/**
 * Called by the analyze route with the user's token. Checks ownership and
 * the rate limit, records a "running" analysis, and returns what the route
 * needs to build the prompt: the resume text and the user's preferences.
 */
export const start = mutation({
  args: { resumeId: v.id("resumes"), promptVersion: v.string() },
  returns: v.object({
    analysisId: v.id("analyses"),
    rawText: v.string(),
    preferences: v.union(
      v.null(),
      v.object({
        preferredRoles: v.array(v.string()),
        jobTypes: v.array(jobTypeValidator),
        targetIndustries: v.array(v.string()),
        location: v.string(),
        graduationYear: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const resume = await ctx.db.get("resumes", args.resumeId)
    if (resume === null || resume.userId !== userId) {
      throw new ConvexError("Resume not found")
    }
    if (resume.status !== "parsed" || !resume.rawText) {
      throw new ConvexError("This resume hasn't been read yet")
    }

    const now = Date.now()
    const latest = await latestForResume(ctx, resume._id)
    if (
      latest?.status === "running" &&
      now - latest.createdAt < ANALYSIS_TIMEOUT_MS
    ) {
      throw new ConvexError("Already analyzing")
    }
    // A run that never reported back (crashed route) is closed out here.
    if (latest?.status === "running") {
      await ctx.db.patch("analyses", latest._id, {
        status: "failed",
        error: "Timed out",
      })
    }

    await limit(ctx, "resumeAnalyze", userId)

    const analysisId = await ctx.db.insert("analyses", {
      resumeId: resume._id,
      userId,
      status: "running",
      createdAt: now,
      promptVersion: args.promptVersion.slice(0, MAX_PROMPT_VERSION),
    })

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique()

    return {
      analysisId,
      rawText: resume.rawText,
      preferences: profile
        ? {
            preferredRoles: profile.preferredRoles,
            jobTypes: profile.jobTypes,
            targetIndustries: profile.targetIndustries,
            location: profile.location,
            graduationYear: profile.graduationYear,
          }
        : null,
    }
  },
})

/** Called by the analyze route (server secret) with the validated result. */
export const complete = mutation({
  args: {
    secret: v.string(),
    analysisId: v.id("analyses"),
    provider: v.string(),
    model: v.string(),
    result: analysisResultValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const analysis = await ctx.db.get("analyses", args.analysisId)
    // Gone (resume deleted) or already closed out as timed out.
    if (analysis === null || analysis.status !== "running") return false
    await ctx.db.patch("analyses", analysis._id, {
      status: "done",
      provider: args.provider,
      model: args.model,
      result: args.result,
      skills: args.result.skills,
      completedAt: Date.now(),
      error: undefined,
    })
    return true
  },
})

/** Called by the analyze route (server secret) when analysis fails. */
export const fail = mutation({
  args: {
    secret: v.string(),
    analysisId: v.id("analyses"),
    error: v.string(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const analysis = await ctx.db.get("analyses", args.analysisId)
    if (analysis === null || analysis.status !== "running") return false
    await ctx.db.patch("analyses", analysis._id, {
      status: "failed",
      error: args.error.slice(0, 500),
      provider: args.provider,
      model: args.model,
      completedAt: Date.now(),
    })
    return true
  },
})

/**
 * Saves the user's corrected skill list. This list (not the raw AI output)
 * is what matching uses. Names go through the same alias map as AI output.
 */
export const updateSkills = mutation({
  args: { analysisId: v.id("analyses"), skills: v.array(skillValidator) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const analysis = await requireOwnAnalysis(ctx, args.analysisId)
    if (analysis.status !== "done") {
      throw new ConvexError("This analysis hasn't finished")
    }
    if (args.skills.length > MAX_SKILLS) {
      throw new ConvexError(`At most ${MAX_SKILLS} skills`)
    }

    const seen = new Set<string>()
    const skills: Infer<typeof skillValidator>[] = []
    for (const skill of args.skills) {
      const tidy = tidySkillName(skill.name)
      if (tidy.length === 0) continue
      const name = aliasFor(tidy) ?? tidy
      const key = skillKey(name)
      if (seen.has(key)) continue
      seen.add(key)
      skills.push({
        name,
        category: skill.category,
        level: skill.level,
        evidence: skill.evidence.trim().slice(0, MAX_SKILL_EVIDENCE),
        // Keep the ESCO link only while the name still matches it.
        escoUri:
          name === skill.name.trim() ? skill.escoUri?.slice(0, 200) : undefined,
      })
    }

    await ctx.db.patch("analyses", analysis._id, {
      skills,
      skillsEditedAt: Date.now(),
    })
    return null
  },
})

/** The user's own resume by a (possibly malformed) id from the URL, or null. */
async function getOwnResumeByString(ctx: QueryCtx, id: string) {
  const userId = await getAuthUserId<"users">(ctx)
  if (userId === null) return null
  const resumeId = ctx.db.normalizeId("resumes", id)
  if (resumeId === null) return null
  const resume = await ctx.db.get("resumes", resumeId)
  if (resume === null || resume.userId !== userId) return null
  return resume
}

/** The newest analysis of one of the user's resumes, or null. */
export const latestForMyResume = query({
  // A string, not v.id: it comes straight from the page URL.
  args: { resumeId: v.string() },
  returns: v.union(v.null(), schema.doc("analyses")),
  handler: async (ctx, args) => {
    const resume = await getOwnResumeByString(ctx, args.resumeId)
    if (resume === null) return null
    return await latestForResume(ctx, resume._id)
  },
})

/** One of the user's analyses (e.g. an older one from the history), or null. */
export const getMine = query({
  args: { analysisId: v.id("analyses") },
  returns: v.union(v.null(), schema.doc("analyses")),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId<"users">(ctx)
    if (userId === null) return null
    const analysis = await ctx.db.get("analyses", args.analysisId)
    if (analysis === null || analysis.userId !== userId) return null
    return analysis
  },
})

/** Earlier analyses of a resume (newest first), without their results. */
export const historyForMyResume = query({
  args: { resumeId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("analyses"),
      status: analysisStatusValidator,
      createdAt: v.number(),
      provider: v.union(v.null(), v.string()),
      model: v.union(v.null(), v.string()),
      promptVersion: v.string(),
      skillCount: v.number(),
      edited: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const resume = await getOwnResumeByString(ctx, args.resumeId)
    if (resume === null) return []
    const rows = await ctx.db
      .query("analyses")
      .withIndex("by_resumeId", (q) => q.eq("resumeId", resume._id))
      .order("desc")
      .take(HISTORY_LIMIT)
    return rows.map((a) => ({
      _id: a._id,
      status: a.status,
      createdAt: a.createdAt,
      provider: a.provider ?? null,
      model: a.model ?? null,
      promptVersion: a.promptVersion,
      skillCount: a.skills?.length ?? 0,
      edited: a.skillsEditedAt !== undefined,
    }))
  },
})

/** The user's most recent finished analysis across resumes (for matching). */
export const latestDoneMine = query({
  args: {},
  returns: v.union(v.null(), schema.doc("analyses")),
  handler: async (ctx) => {
    const userId = await getAuthUserId<"users">(ctx)
    if (userId === null) return null
    return await ctx.db
      .query("analyses")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "done")
      )
      .order("desc")
      .first()
  },
})
