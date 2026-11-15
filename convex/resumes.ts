import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError, v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { limit } from "./rateLimits"
import {
  MAX_RESUME_BYTES,
  MAX_RESUME_TEXT,
  PARSE_TIMEOUT_MS,
  RESUME_MIME_TYPES,
} from "./resumeLimits"
import { analysisStatusValidator, resumeStatusValidator } from "./schema"
import { requireServerSecret, requireUserId } from "./serverAuth"

const MAX_FILE_NAME = 200
const LIST_LIMIT = 20
const ALLOWED_MIME = new Set<string>(Object.values(RESUME_MIME_TYPES))

/** Loads a resume and checks that the signed-in user owns it. */
async function requireOwnResume(ctx: QueryCtx, resumeId: Id<"resumes">) {
  const userId = await requireUserId(ctx)
  const resume = await ctx.db.get("resumes", resumeId)
  if (resume === null || resume.userId !== userId) {
    throw new ConvexError("Resume not found")
  }
  return resume
}

/** Step 1 of an upload: a short-lived URL the browser POSTs the file to. */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    await limit(ctx, "resumeUpload", userId)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Step 2 of an upload: record the stored file. Checks the size and the
 * declared type here; the parse route checks the real type from the bytes.
 */
export const create = mutation({
  args: { storageId: v.id("_storage"), fileName: v.string() },
  returns: v.id("resumes"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)

    const claimed = await ctx.db
      .query("resumes")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique()
    if (claimed !== null) throw new ConvexError("File already uploaded")

    const file = await ctx.db.system.get("_storage", args.storageId)
    if (file === null) throw new ConvexError("Upload not found")

    const problem =
      file.size > MAX_RESUME_BYTES
        ? "File is larger than 5 MB"
        : file.size === 0
          ? "File is empty"
          : !file.contentType || !ALLOWED_MIME.has(file.contentType)
            ? "Only PDF and DOCX files are supported"
            : null
    if (problem !== null) {
      await ctx.storage.delete(args.storageId)
      throw new ConvexError(problem)
    }

    const fileName = args.fileName.trim().slice(0, MAX_FILE_NAME) || "resume"
    return await ctx.db.insert("resumes", {
      userId,
      storageId: args.storageId,
      fileName,
      status: "uploaded",
    })
  },
})

const resumeSummary = v.object({
  _id: v.id("resumes"),
  _creationTime: v.number(),
  fileName: v.string(),
  status: resumeStatusValidator,
  error: v.union(v.null(), v.string()),
  parseMethod: v.union(v.null(), v.string()),
  textLength: v.number(),
  preview: v.union(v.null(), v.string()),
  /** The newest analysis of this resume (Phase 3), if any. */
  analysis: v.union(
    v.null(),
    v.object({
      _id: v.id("analyses"),
      status: analysisStatusValidator,
      createdAt: v.number(),
      error: v.union(v.null(), v.string()),
    })
  ),
})

/** The signed-in user's latest resumes (newest first), without full text. */
export const listMine = query({
  args: {},
  returns: v.array(resumeSummary),
  handler: async (ctx) => {
    const userId = await getAuthUserId<"users">(ctx)
    if (userId === null) return []
    const rows = await ctx.db
      .query("resumes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(LIST_LIMIT)
    return await Promise.all(
      rows.map(async (r) => {
        const latest = await ctx.db
          .query("analyses")
          .withIndex("by_resumeId", (q) => q.eq("resumeId", r._id))
          .order("desc")
          .first()
        return {
          _id: r._id,
          _creationTime: r._creationTime,
          fileName: r.fileName,
          status: r.status,
          error: r.error ?? null,
          parseMethod: r.parseMethod ?? null,
          textLength: r.rawText?.length ?? 0,
          preview: r.rawText ? r.rawText.slice(0, 600) : null,
          analysis: latest
            ? {
                _id: latest._id,
                status: latest.status,
                createdAt: latest.createdAt,
                error: latest.error ?? null,
              }
            : null,
        }
      })
    )
  },
})

/** One of the signed-in user's resumes, including its full text. */
export const getMine = query({
  // A string, not v.id: the analysis page passes the id from its URL.
  args: { resumeId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("resumes"),
      fileName: v.string(),
      status: resumeStatusValidator,
      rawText: v.union(v.null(), v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId<"users">(ctx)
    if (userId === null) return null
    const resumeId = ctx.db.normalizeId("resumes", args.resumeId)
    if (resumeId === null) return null
    const r = await ctx.db.get("resumes", resumeId)
    if (r === null || r.userId !== userId) return null
    return {
      _id: r._id,
      fileName: r.fileName,
      status: r.status,
      rawText: r.rawText ?? null,
    }
  },
})

/** Deletes a resume, its stored file, and its analyses. */
export const remove = mutation({
  args: { resumeId: v.id("resumes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resume = await requireOwnResume(ctx, args.resumeId)
    // History per resume is small (analyses are rate-limited), so one
    // bounded batch covers it.
    const analyses = await ctx.db
      .query("analyses")
      .withIndex("by_resumeId", (q) => q.eq("resumeId", resume._id))
      .take(500)
    for (const a of analyses) await ctx.db.delete("analyses", a._id)
    await ctx.storage.delete(resume.storageId)
    await ctx.db.delete("resumes", resume._id)
    return null
  },
})

/**
 * Called by the parse route with the user's token, so ownership is checked
 * here. Marks the resume as parsing and returns a URL to download the file
 * from, plus an attempt id the route passes back with the result.
 */
export const startParsing = mutation({
  args: { resumeId: v.id("resumes") },
  returns: v.object({
    fileUrl: v.string(),
    fileName: v.string(),
    attempt: v.number(),
  }),
  handler: async (ctx, args) => {
    const resume = await requireOwnResume(ctx, args.resumeId)
    const now = Date.now()
    const stale =
      resume.status === "parsing" &&
      now - (resume.parseStartedAt ?? 0) > PARSE_TIMEOUT_MS
    if (resume.status === "parsed") throw new ConvexError("Already parsed")
    if (resume.status === "parsing" && !stale) {
      throw new ConvexError("Already parsing")
    }

    const fileUrl = await ctx.storage.getUrl(resume.storageId)
    if (fileUrl === null) throw new ConvexError("Stored file is missing")

    await limit(ctx, "resumeParse", resume.userId)
    await ctx.db.patch("resumes", resume._id, {
      status: "parsing",
      parseStartedAt: now,
      error: undefined,
    })
    return { fileUrl, fileName: resume.fileName, attempt: now }
  },
})

// The parse route reports results with the server secret (requireServerSecret)
// instead of the user's token: access tokens live 60s and OCR can take
// longer, and users must not be able to write "parsed" text themselves.

/** Loads a resume that is being parsed by this exact attempt, or null. */
async function getParsingAttempt(
  ctx: QueryCtx,
  resumeId: Id<"resumes">,
  attempt: number
) {
  const resume = await ctx.db.get("resumes", resumeId)
  if (resume === null || resume.status !== "parsing") return null
  // A newer attempt (after a timeout) owns the row; drop this stale result.
  if (resume.parseStartedAt !== attempt) return null
  return resume
}

const parserArgs = {
  secret: v.string(),
  resumeId: v.id("resumes"),
  attempt: v.number(),
}

/** Called by the parse route when text extraction succeeds. */
export const completeParsing = mutation({
  args: {
    ...parserArgs,
    rawText: v.string(),
    parseMethod: v.union(
      v.literal("pdf"),
      v.literal("docx"),
      v.literal("pdf-ocr")
    ),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const resume = await getParsingAttempt(ctx, args.resumeId, args.attempt)
    if (resume === null) return false
    const rawText = args.rawText.slice(0, MAX_RESUME_TEXT)
    if (rawText.trim().length === 0)
      throw new ConvexError("Extracted text is empty")
    await ctx.db.patch("resumes", resume._id, {
      status: "parsed",
      rawText,
      parseMethod: args.parseMethod,
      error: undefined,
    })
    return true
  },
})

/** Called by the parse route when text extraction fails. */
export const failParsing = mutation({
  args: { ...parserArgs, error: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    requireServerSecret(args.secret)
    const resume = await getParsingAttempt(ctx, args.resumeId, args.attempt)
    if (resume === null) return false
    await ctx.db.patch("resumes", resume._id, {
      status: "failed",
      error: args.error.slice(0, 500),
    })
    return true
  },
})
