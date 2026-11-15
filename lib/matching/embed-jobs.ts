import "server-only"

import { fetchMutation, fetchQuery } from "convex/nextjs"

import { api } from "@/convex/_generated/api"
import { embed } from "@/lib/ai"
import { serverEnv } from "@/lib/env"

import { jobEmbeddingText } from "./text"

const BATCH = 50

export interface EmbedJobsResult {
  embedded: number
  /** Embedding requests made (for the Gemini free quota). */
  calls: number
  /** Listings still without an embedding when this stopped. */
  remaining: boolean
  error?: string
}

/**
 * Embeds listings that have no embedding yet, in requests of 50, for up to
 * `budgetMs`. The free tier allows 100 texts a minute, so rate-limit errors
 * are waited out while time remains; whatever is left (or fails) is picked
 * up by the next sync. `secret` is RESUME_PARSER_SECRET.
 */
export async function embedPendingJobs(
  secret: string,
  budgetMs = 150_000
): Promise<EmbedJobsResult> {
  const deadline = Date.now() + budgetMs
  const env = serverEnv()
  if (!env.GEMINI_API_KEY) {
    return {
      embedded: 0,
      calls: 0,
      remaining: true,
      error: "GEMINI_API_KEY not set",
    }
  }

  let embedded = 0
  let calls = 0
  while (Date.now() < deadline) {
    const jobs = await fetchQuery(api.jobs.pendingEmbeddings, {
      secret,
      limit: BATCH,
    })
    if (jobs.length === 0) return { embedded, calls, remaining: false }
    let vectors: number[][]
    try {
      calls++
      vectors = await embed(jobs.map(jobEmbeddingText), "document", {
        maxWaitMs: Math.max(0, deadline - Date.now()),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[matches] job embedding stopped: ${message.slice(0, 300)}`)
      return { embedded, calls, remaining: true, error: message.slice(0, 300) }
    }
    embedded += await fetchMutation(api.jobs.setEmbeddings, {
      secret,
      model: env.GEMINI_EMBEDDING_MODEL,
      items: jobs.map((job, k) => ({ jobId: job._id, embedding: vectors[k] })),
    })
  }
  const left = await fetchQuery(api.jobs.pendingEmbeddings, {
    secret,
    limit: 1,
  })
  return { embedded, calls, remaining: left.length > 0 }
}
