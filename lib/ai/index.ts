import "server-only"

import { serverEnv } from "@/lib/env"

import { createGeminiProvider } from "./gemini"
import { createGroqProvider } from "./groq"
import { safeErrorMessage } from "./redact"
import type { AIProvider, AIProviderName } from "./types"

export type { AIProvider, AIProviderName, GenerateTextOptions } from "./types"
export {
  embed,
  EMBEDDING_DIMENSIONS,
  type EmbedKind,
  type EmbedOptions,
} from "./embeddings"

/** Which providers have an API key configured. */
export function configuredProviders(): AIProviderName[] {
  const env = serverEnv()
  const names: AIProviderName[] = []
  if (env.GEMINI_API_KEY) names.push("gemini")
  if (env.GROQ_API_KEY) names.push("groq")
  return names
}

/**
 * A provider that accepts file attachments (currently only Gemini), or null.
 * Uses GEMINI_OCR_MODEL: reading documents needs speed, not reasoning.
 */
export function getFileCapableProvider(): AIProvider | null {
  const env = serverEnv()
  if (env.GEMINI_API_KEY) {
    return createGeminiProvider(env.GEMINI_API_KEY, env.GEMINI_OCR_MODEL)
  }
  return null
}

function createProvider(name: AIProviderName): AIProvider | null {
  const env = serverEnv()
  if (name === "gemini" && env.GEMINI_API_KEY) {
    return createGeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL)
  }
  if (name === "groq" && env.GROQ_API_KEY) {
    return createGroqProvider(env.GROQ_API_KEY, env.GROQ_MODEL)
  }
  return null
}

/**
 * Returns an AI provider. The primary is AI_PROVIDER (default groq); the
 * other provider is the fallback. With both keys set, a failed request
 * (rate limit, outage, …) is retried once on the fallback, and requests with
 * `files` go straight to a provider that accepts them.
 */
export function getAIProvider(preferred?: AIProviderName): AIProvider {
  const env = serverEnv()
  const order: AIProviderName[] =
    (preferred ?? env.AI_PROVIDER) === "gemini"
      ? ["gemini", "groq"]
      : ["groq", "gemini"]
  const [primary, fallback] = order
    .map(createProvider)
    .filter((p): p is AIProvider => p !== null)

  if (!primary) {
    throw new Error(
      "No AI provider configured. Set GROQ_API_KEY or GEMINI_API_KEY in .env.local."
    )
  }
  if (!fallback) return primary
  return withFallback(primary, fallback)
}

/**
 * Every configured provider, primary (AI_PROVIDER) first, each without the
 * automatic fallback. For features that run their own retry policy across
 * providers, such as resume analysis (validate → retry → other provider).
 */
export function getAIProviders(preferred?: AIProviderName): AIProvider[] {
  const env = serverEnv()
  const order: AIProviderName[] =
    (preferred ?? env.AI_PROVIDER) === "gemini"
      ? ["gemini", "groq"]
      : ["groq", "gemini"]
  return order.map(createProvider).filter((p): p is AIProvider => p !== null)
}

function withFallback(primary: AIProvider, fallback: AIProvider): AIProvider {
  return {
    name: primary.name,
    model: primary.model,
    supportsFiles: primary.supportsFiles || fallback.supportsFiles,
    async generateText(options) {
      if (options.files?.length && !primary.supportsFiles) {
        return fallback.generateText(options)
      }
      try {
        // One try on the primary: when it is rate limited or down, switching
        // provider is faster than waiting out a backoff. The fallback then
        // gets the full retry policy.
        return await primary.generateText({ ...options, attempts: 1 })
      } catch (error) {
        console.warn(
          `[ai] ${primary.name} failed, falling back to ${fallback.name}:`,
          safeErrorMessage(error)
        )
        return fallback.generateText(options)
      }
    },
  }
}

/**
 * A small, cheap model for high-volume labelling (job classification):
 * Groq GROQ_CLASSIFY_MODEL, else Gemini Flash-Lite. Null when neither key is set.
 */
export function getCheapProvider(): AIProvider | null {
  const env = serverEnv()
  if (env.GROQ_API_KEY) {
    return createGroqProvider(env.GROQ_API_KEY, env.GROQ_CLASSIFY_MODEL)
  }
  if (env.GEMINI_API_KEY) {
    return createGeminiProvider(env.GEMINI_API_KEY, env.GEMINI_OCR_MODEL)
  }
  return null
}
