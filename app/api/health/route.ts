import { timingSafeEqual } from "node:crypto"

import { configuredProviders, getAIProvider } from "@/lib/ai"
import { serverEnv } from "@/lib/env"

export const runtime = "nodejs"

/**
 * Integration check.
 *   GET /api/health        → which services are configured (no network calls)
 *   GET /api/health?ai=1   → also sends a one-word prompt to the AI provider
 *
 * `?ai=1` spends AI quota, so outside development it needs the ops header
 * `x-jobs-sync-secret: <JOBS_SYNC_SECRET>`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const providers = configuredProviders()

  const result: Record<string, unknown> = {
    convex: Boolean(process.env.NEXT_PUBLIC_CONVEX_URL),
    aiProviders: providers,
  }

  if (url.searchParams.get("ai") === "1" && providers.length > 0) {
    if (!mayCallAI(request)) {
      return Response.json(
        { ...result, error: "?ai=1 needs the x-jobs-sync-secret header" },
        { status: 403 }
      )
    }
    try {
      const ai = getAIProvider()
      const reply = await ai.generateText({
        prompt: "Reply with exactly: ok",
        feature: "health",
        attempts: 1,
      })
      result.ai = { provider: ai.name, model: ai.model, reply: reply.trim() }
    } catch (error) {
      result.ai = {
        error: error instanceof Error ? error.message : String(error),
      }
      return Response.json(result, { status: 502 })
    }
  }

  return Response.json(result)
}

function mayCallAI(request: Request) {
  if (process.env.NODE_ENV === "development") return true
  const expected = serverEnv().JOBS_SYNC_SECRET
  const given = request.headers.get("x-jobs-sync-secret")
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
