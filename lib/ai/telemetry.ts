import "server-only"

import { fetchMutation } from "convex/nextjs"

import { api } from "@/convex/_generated/api"
import { serverEnv } from "@/lib/env"

import { errorStatus, withRetry } from "./retry"
import type { AIProvider, AIProviderName, GenerateTextOptions } from "./types"

export interface AICallRecord {
  provider: string
  model: string
  feature: string
  ms: number
  ok: boolean
  status?: number
  attempt: number
  inputTokens?: number
  outputTokens?: number
}

/**
 * Logs one AI request as a single JSON line and stores it in Convex for the
 * usage page. Only metadata: never the prompt, the reply or any resume text.
 * Fire and forget: telemetry must never fail or slow down the request.
 */
export function recordAICall(call: AICallRecord) {
  console.info(JSON.stringify({ event: "ai_call", ...call }))
  const secret = serverEnv().RESUME_PARSER_SECRET
  if (!secret || !process.env.NEXT_PUBLIC_CONVEX_URL) return
  void fetchMutation(api.aiCalls.record, {
    secret,
    call: { ...call, at: Date.now() },
  }).catch(() => {})
}

export interface ProviderResult {
  text: string
  inputTokens?: number
  outputTokens?: number
}

/** Default per-attempt timeout. OCR and analysis stay well under this. */
const DEFAULT_TIMEOUT_MS = 45_000

/**
 * Wraps a provider's raw call with what every AI request needs: a timeout
 * per attempt, retries with backoff on 429/5xx/timeouts, and a telemetry
 * record per attempt.
 */
export function instrument(
  name: AIProviderName,
  model: string,
  supportsFiles: boolean,
  call: (
    options: GenerateTextOptions,
    signal: AbortSignal
  ) => Promise<ProviderResult>
): AIProvider {
  return {
    name,
    model,
    supportsFiles,
    async generateText(options) {
      const feature = options.feature ?? "other"
      const result = await withRetry(
        async (attempt) => {
          const started = performance.now()
          const signal = AbortSignal.timeout(
            options.timeoutMs ?? DEFAULT_TIMEOUT_MS
          )
          try {
            const r = await call(options, signal)
            recordAICall({
              provider: name,
              model,
              feature,
              ms: Math.round(performance.now() - started),
              ok: true,
              attempt,
              inputTokens: r.inputTokens,
              outputTokens: r.outputTokens,
            })
            return r
          } catch (error) {
            recordAICall({
              provider: name,
              model,
              feature,
              ms: Math.round(performance.now() - started),
              ok: false,
              status: errorStatus(error),
              attempt,
            })
            throw error
          }
        },
        { attempts: options.attempts ?? 3 }
      )
      return result.text
    },
  }
}
