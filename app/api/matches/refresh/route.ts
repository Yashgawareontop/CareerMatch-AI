import { fetchMutation } from "convex/nextjs"
import { ConvexError } from "convex/values"

import { api } from "@/convex/_generated/api"
import { convexAuthNextjsAccessToken } from "@/lib/auth/server"
import { serverEnv } from "@/lib/env"
import { computeMatches } from "@/lib/matching"

export const runtime = "nodejs"
// Embedding + vector search take ~2 s; the explanation call up to 2 × 45 s.
export const maxDuration = 120

/**
 * POST /api/matches/refresh
 * Recomputes the signed-in user's recommendations from their latest
 * analysis and stores them in `matches` (the UI reads them reactively).
 * The user's token is only used for `matches.begin` (rate limit, ownership);
 * results are written with the server secret.
 */
export async function POST(request: Request) {
  const env = serverEnv()
  const secret = env.RESUME_PARSER_SECRET
  if (!secret || !env.GEMINI_API_KEY) {
    console.error(
      "[matches/refresh] RESUME_PARSER_SECRET or GEMINI_API_KEY is not set"
    )
    return Response.json(
      { error: "Recommendations are not configured" },
      { status: 500 }
    )
  }

  const token = bearerToken(request) ?? (await convexAuthNextjsAccessToken())
  if (!token) return Response.json({ error: "Not signed in" }, { status: 401 })

  let started
  try {
    started = await fetchMutation(api.matches.begin, {}, { token })
  } catch (error) {
    const message =
      error instanceof ConvexError
        ? String(error.data)
        : "Could not start refresh"
    const status = message.startsWith("Too many")
      ? 429
      : message === "Not signed in"
        ? 401
        : message === "Already refreshing"
          ? 409
          : 400
    return Response.json({ error: message }, { status })
  }

  const { runId, dismissedJobIds, ...profile } = started
  try {
    const output = await computeMatches(secret, runId, profile, dismissedJobIds)
    return Response.json({ status: "done", ...output })
  } catch (error) {
    console.error("[matches/refresh] failed", error)
    const message = "Could not update your recommendations. Please try again."
    await fetchMutation(api.matches.fail, {
      secret,
      runId,
      error: message,
    }).catch((e) =>
      console.error("[matches/refresh] could not record failure", e)
    )
    return Response.json({ status: "failed", error: message }, { status: 502 })
  }
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization")
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}
