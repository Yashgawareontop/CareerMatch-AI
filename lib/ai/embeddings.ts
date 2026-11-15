import "server-only"

import { GoogleGenAI } from "@google/genai"

import { serverEnv } from "@/lib/env"

import { errorStatus } from "./retry"
import { recordAICall } from "./telemetry"

/** Vector size stored in Convex (must match the vector index in convex/schema.ts). */
export const EMBEDDING_DIMENSIONS = 768

/** "document" for job listings, "query" for user profiles (asymmetric retrieval). */
export type EmbedKind = "document" | "query"

const MAX_INPUT_CHARS = 8000

export interface EmbedOptions {
  /**
   * On a rate-limit error (the free tier allows 100 texts per minute), wait
   * the delay Gemini asks for and retry, as long as the total wait stays
   * under this. Default 0: fail at once.
   */
  maxWaitMs?: number
}

/**
 * Embeds texts with Gemini (GEMINI_EMBEDDING_MODEL, default gemini-embedding-001).
 * Groq has no embeddings, so this is Gemini-only. Vectors are L2-normalised:
 * Gemini only normalises the full 3072-dim output, not truncated ones.
 */
export async function embed(
  texts: string[],
  kind: EmbedKind = "document",
  options: EmbedOptions = {}
): Promise<number[][]> {
  if (texts.length === 0) return []
  const env = serverEnv()
  if (!env.GEMINI_API_KEY) {
    throw new Error("Embeddings need GEMINI_API_KEY (Groq has no embeddings).")
  }
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  const request = () =>
    client.models.embedContent({
      model: env.GEMINI_EMBEDDING_MODEL,
      contents: texts.map((t) => t.slice(0, MAX_INPUT_CHARS)),
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
      },
    })

  let waited = 0
  let attempt = 0
  let response: Awaited<ReturnType<typeof request>>
  for (;;) {
    attempt++
    const started = performance.now()
    const call = {
      provider: "gemini",
      model: env.GEMINI_EMBEDDING_MODEL,
      feature: kind === "query" ? "embed-profile" : "embed-jobs",
      attempt,
    }
    try {
      response = await request()
      recordAICall({
        ...call,
        ms: Math.round(performance.now() - started),
        ok: true,
      })
      break
    } catch (error) {
      recordAICall({
        ...call,
        ms: Math.round(performance.now() - started),
        ok: false,
        status: errorStatus(error),
      })
      const delay = retryDelayMs(error)
      if (delay === null || waited + delay > (options.maxWaitMs ?? 0))
        throw error
      waited += delay
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  const vectors = (response.embeddings ?? []).map((e) =>
    normalise(e.values ?? [])
  )
  if (
    vectors.length !== texts.length ||
    vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)
  ) {
    throw new Error("Embedding response had an unexpected shape")
  }
  return vectors
}

/** The wait a 429 asks for ("Please retry in 51.4s"), plus a margin, or null. */
function retryDelayMs(error: unknown): number | null {
  const text = error instanceof Error ? error.message : String(error)
  if (!/\b429\b|RESOURCE_EXHAUSTED/.test(text)) return null
  // A daily quota can't be waited out within one request.
  if (/per ?day|PerDay/i.test(text)) return null
  const match =
    text.match(/retry in ([\d.]+)s/i) ?? text.match(/"retryDelay":"(\d+)s"/)
  const seconds = match ? Number(match[1]) : 60
  return Math.ceil(seconds * 1000) + 1000
}

function normalise(v: number[]): number[] {
  const norm = Math.hypot(...v)
  return norm > 0 ? v.map((x) => x / norm) : v
}
