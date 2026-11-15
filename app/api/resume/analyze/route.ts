import { fetchMutation, fetchQuery } from "convex/nextjs"
import { ConvexError } from "convex/values"
import { z } from "zod"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  AnalysisError,
  analyzeResume,
  PROMPT_VERSION,
  type SkillCache,
} from "@/lib/analysis"
import { convexAuthNextjsAccessToken } from "@/lib/auth/server"
import { serverEnv } from "@/lib/env"

export const runtime = "nodejs"
// Worst case: 2 providers × 2 attempts × 55 s, plus ESCO lookups.
export const maxDuration = 240

const bodySchema = z.object({ resumeId: z.string().min(1).max(64) })

/**
 * POST /api/resume/analyze  { resumeId }
 * Runs the AI analysis of a parsed resume and stores it as a new row in
 * `analyses` (earlier rows are kept as history).
 *
 * Like the parse route, the user's token is only used for `analyses.start`
 * (ownership + rate limit); the result is written with the server secret.
 */
export async function POST(request: Request) {
  const secret = serverEnv().RESUME_PARSER_SECRET
  if (!secret) {
    console.error("[resume/analyze] RESUME_PARSER_SECRET is not set")
    return Response.json(
      { error: "Resume analysis is not configured" },
      { status: 500 }
    )
  }

  const token = bearerToken(request) ?? (await convexAuthNextjsAccessToken())
  if (!token) return Response.json({ error: "Not signed in" }, { status: 401 })

  const body = bodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return Response.json({ error: "Expected { resumeId }" }, { status: 400 })
  }
  const resumeId = body.data.resumeId as Id<"resumes">

  let started: Awaited<ReturnType<typeof startAnalysis>>
  try {
    started = await startAnalysis(resumeId, token)
  } catch (error) {
    const message =
      error instanceof ConvexError
        ? String(error.data)
        : "Could not start analysis"
    const status = message.startsWith("Too many")
      ? 429
      : message === "Not signed in"
        ? 401
        : 400
    return Response.json({ error: message }, { status })
  }

  const { analysisId, rawText, preferences } = started
  try {
    const output = await analyzeResume({
      resumeText: rawText,
      preferences,
      skillCache: convexSkillCache(secret),
    })
    await fetchMutation(api.analyses.complete, {
      secret,
      analysisId,
      provider: output.provider,
      model: output.model,
      result: output.result,
    })
    return Response.json({
      status: "done",
      analysisId,
      provider: output.provider,
      model: output.model,
      attempts: output.attempts.length,
    })
  } catch (error) {
    const message =
      error instanceof AnalysisError
        ? error.message
        : "Something went wrong while analyzing this resume. Please try again."
    if (!(error instanceof AnalysisError)) {
      console.error("[resume/analyze] unexpected error", error)
    }
    const last =
      error instanceof AnalysisError ? error.attempts.at(-1) : undefined
    await fetchMutation(api.analyses.fail, {
      secret,
      analysisId,
      error: message,
      provider: last?.provider,
      model: last?.model,
    }).catch((e) =>
      console.error("[resume/analyze] could not record failure", e)
    )
    return Response.json({ status: "failed", error: message }, { status: 502 })
  }
}

function startAnalysis(resumeId: Id<"resumes">, token: string) {
  return fetchMutation(
    api.analyses.start,
    { resumeId, promptVersion: PROMPT_VERSION },
    { token }
  )
}

/** The ESCO lookup cache, stored in Convex and written with the server secret. */
function convexSkillCache(secret: string): SkillCache {
  return {
    lookup: (keys) => fetchQuery(api.skillCache.lookup, { secret, keys }),
    remember: async (entries) => {
      await fetchMutation(api.skillCache.remember, { secret, entries })
    },
  }
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization")
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}
