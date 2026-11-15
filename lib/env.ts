import "server-only"

import { z } from "zod"

/**
 * Server-side environment variables, validated once at first access.
 * Anything without the NEXT_PUBLIC_ prefix stays on the server.
 */
const serverEnvSchema = z.object({
  AI_PROVIDER: z.enum(["groq", "gemini"]).default("groq"),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.6-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  // Reads scanned resumes. Flash-Lite is free and ~10x faster than Flash here.
  GEMINI_OCR_MODEL: z.string().default("gemini-3.5-flash-lite"),

  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  // Small, cheap model for batch job classification (Phase 4).
  GROQ_CLASSIFY_MODEL: z.string().default("openai/gpt-oss-20b"),

  // Shared with the Convex deployment (`npx convex env set`); the resume
  // parse route uses it to report results.
  RESUME_PARSER_SECRET: z.string().min(32).optional(),

  ADZUNA_APP_ID: z.string().optional(),
  ADZUNA_APP_KEY: z.string().optional(),
  ADZUNA_COUNTRY: z.string().default("in"),
  JOOBLE_API_KEY: z.string().optional(),
  JOOBLE_LOCATION: z.string().default("India"),
  // Header secret for POST /api/jobs/sync (also set on Convex for the cron).
  JOBS_SYNC_SECRET: z.string().min(32).optional(),
  ONET_API_KEY: z.string().optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cached: ServerEnv | undefined

export function serverEnv(): ServerEnv {
  if (cached) return cached
  // Treat empty strings from .env files as "not set".
  const raw = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== "")
  )
  const parsed = serverEnvSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(parsed.error)}`
    )
  }
  cached = parsed.data
  return cached
}
