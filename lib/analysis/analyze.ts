import "server-only"

import { MAX_SKILLS, skillKey } from "@/convex/skillNames"
import { getAIProviders, type AIProvider } from "@/lib/ai"
import { safeErrorMessage } from "@/lib/ai/redact"

import {
  buildPrompt,
  buildRetryPrompt,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  type JobType,
  type PromptPreferences,
} from "./prompt"
import {
  aiAnalysisSchema,
  type AIAnalysis,
  type AnalysisResult,
} from "./schema"
import { cleanSkills, type SkillCache } from "./skills"

/** Shown to the user, so it must be readable. */
export class AnalysisError extends Error {
  constructor(
    message: string,
    readonly attempts: AttemptLog[] = []
  ) {
    super(message)
    this.name = "AnalysisError"
  }
}

export interface AttemptLog {
  provider: string
  model: string
  outcome: "ok" | "invalid" | "error"
  detail?: string
  ms: number
}

export interface AnalyzeOutput {
  result: AnalysisResult
  provider: string
  model: string
  promptVersion: string
  attempts: AttemptLog[]
}

/**
 * A single AI call may not take longer than this. Gemini Flash needs ~25 s
 * for a full analysis under load (measured Nov 2026, minimal thinking).
 */
const CALL_TIMEOUT_MS = 55_000
const TEMPERATURE = 0.2

/**
 * Analyzes resume text with the configured AI providers.
 *
 * Per provider (primary first): ask once; if the reply isn't valid JSON for
 * `aiAnalysisSchema`, ask again with the validation errors included; if that
 * fails too (or the request errors), move on to the next provider.
 */
export async function analyzeResume({
  resumeText,
  preferences,
  skillCache,
  providers = getAIProviders(),
}: {
  resumeText: string
  preferences: PromptPreferences | null
  skillCache: SkillCache | null
  providers?: AIProvider[]
}): Promise<AnalyzeOutput> {
  if (providers.length === 0) {
    throw new AnalysisError("AI analysis is not configured on this server.")
  }

  const prompt = buildPrompt(resumeText, preferences)
  const attempts: AttemptLog[] = []

  for (const provider of providers) {
    const parsed = await tryProvider(provider, prompt, attempts)
    if (parsed === null) continue

    const result = await toResult(parsed, preferences, skillCache)
    return {
      result,
      provider: provider.name,
      model: provider.model,
      promptVersion: PROMPT_VERSION,
      attempts,
    }
  }

  console.error("[analysis] all providers failed", attempts)
  throw new AnalysisError(
    "We couldn't analyze this resume right now. Please try again in a few minutes.",
    attempts
  )
}

async function tryProvider(
  provider: AIProvider,
  prompt: string,
  attempts: AttemptLog[]
): Promise<AIAnalysis | null> {
  let currentPrompt = prompt
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now()
    const log = (outcome: AttemptLog["outcome"], detail?: string) =>
      attempts.push({
        provider: provider.name,
        model: provider.model,
        outcome,
        // Logged when every provider fails: never keep model output.
        detail: detail === undefined ? undefined : safeErrorMessage(detail),
        ms: Date.now() - started,
      })

    let reply: string
    try {
      reply = await withTimeout(
        provider.generateText({
          system: SYSTEM_PROMPT,
          prompt: currentPrompt,
          json: true,
          temperature: TEMPERATURE,
          // Extraction doesn't need deliberation; full thinking took Gemini
          // Flash ~100 s per resume versus ~25 s with minimal.
          reasoning: "minimal",
          feature: "analysis",
          // This loop already retries and switches provider on bad output;
          // one quick transport retry (e.g. a 429) fits in CALL_TIMEOUT_MS.
          timeoutMs: CALL_TIMEOUT_MS,
          attempts: 2,
        }),
        CALL_TIMEOUT_MS
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Groq checks JSON mode server-side and rejects malformed output with
      // a 400. That's a bad reply, not an outage: retry with the error.
      if (/json_validate_failed|failed to generate json/i.test(message)) {
        log("invalid", message)
        currentPrompt = buildRetryPrompt(
          prompt,
          "",
          "- The reply was not valid JSON (it was cut off or malformed). Keep evidence and highlights short."
        )
        continue
      }
      // Other request errors (rate limit, outage, timeout) aren't fixed by
      // re-asking the same provider: go to the next one.
      log("error", message)
      return null
    }

    const checked = parseReply(reply)
    if (checked.ok) {
      log("ok")
      return checked.data
    }
    log("invalid", checked.problems)
    currentPrompt = buildRetryPrompt(prompt, reply, checked.problems)
  }
  return null
}

type Checked = { ok: true; data: AIAnalysis } | { ok: false; problems: string }

/** Parses and validates a model reply. Exported for the sample script. */
export function parseReply(reply: string): Checked {
  let json: unknown
  try {
    json = JSON.parse(stripFences(reply))
  } catch {
    return { ok: false, problems: "- The reply was not valid JSON." }
  }
  const parsed = aiAnalysisSchema.safeParse(json)
  if (parsed.success) return { ok: true, data: parsed.data }
  const problems = parsed.error.issues
    .slice(0, 15)
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n")
  return { ok: false, problems }
}

/** Some models wrap JSON in ```json fences even in JSON mode. */
function stripFences(reply: string) {
  const trimmed = reply.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
}

/** Cleans skill names and merges the resume's goals with saved preferences. */
async function toResult(
  ai: AIAnalysis,
  preferences: PromptPreferences | null,
  skillCache: SkillCache | null
): Promise<AnalysisResult> {
  const skills = (await cleanSkills(ai.skills, skillCache)).slice(0, MAX_SKILLS)
  const { careerGoals } = ai

  const jobTypes: JobType[] = preferences?.jobTypes.length
    ? [...preferences.jobTypes]
    : ai.seniority === "student" || ai.seniority === "intern"
      ? ["internship"]
      : ["full-time"]

  return {
    ...ai,
    skills,
    careerGoals: {
      // The user's own choices come first.
      targetRoles: mergeLists(
        preferences?.preferredRoles ?? [],
        careerGoals.targetRoles,
        10
      ),
      industries: mergeLists(
        preferences?.targetIndustries ?? [],
        careerGoals.industries,
        10
      ),
      locations: mergeLists(
        preferences?.location ? [preferences.location] : [],
        careerGoals.locations,
        10
      ),
      jobTypes,
      statedGoal: careerGoals.statedGoal,
    },
  }
}

function mergeLists(first: string[], second: string[], max: number) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of [...first, ...second]) {
    const key = skillKey(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item.trim())
  }
  return out.slice(0, max)
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timed out after ${ms / 1000}s`)),
      ms
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
