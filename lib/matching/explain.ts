import "server-only"

import { z } from "zod"

import type { Doc } from "@/convex/_generated/dataModel"
import { aliasFor, tidySkillName } from "@/convex/skillNames"
import { getAIProviders } from "@/lib/ai"
import { safeErrorMessage } from "@/lib/ai/redact"

import { profileRoles } from "./text"
import type { MatchProfile, ScoredMatch } from "./types"

// Ranking step 3: one batched AI call explains the top matches (why the job
// fits, which skills are missing). Validated with Zod; when every provider
// fails, the matches keep rule-based reasons instead.

export const EXPLAIN_TOP = 10
const TIMEOUT_MS = 45_000
const MAX_REASON = 400

const replySchema = z.object({
  items: z.array(
    z.object({
      i: z.number().int(),
      reason: z.string().min(1),
      missingSkills: z.array(z.string()).max(10),
    })
  ),
})

const SYSTEM = `You are a career advisor. For each job, explain in one or two short sentences (max 45 words) why it fits this candidate, citing concrete skills or goals. Be honest about a weak fit. Then list up to 5 important skills the job asks for that the candidate lacks (short canonical names, e.g. "Kubernetes"), most important first, or [] if none.
Address the candidate as "you". Reply with JSON only:
{"items":[{"i":0,"reason":"...","missingSkills":["..."]}]}`

export interface Explanation {
  reason: string
  missingSkills: string[]
}

function buildPrompt(
  profile: MatchProfile,
  top: { match: ScoredMatch; job: Doc<"jobs"> }[]
) {
  const skills = profile.skills
    .filter((s) => s.category !== "soft")
    .slice(0, 40)
    .map((s) => `${s.name} (${s.level})`)
    .join(", ")
  const candidate = [
    `Seniority: ${profile.seniority}`,
    `Looking for: ${profileRoles(profile).join(", ") || "not stated"}`,
    profile.careerGoals.statedGoal && `Goal: ${profile.careerGoals.statedGoal}`,
    `Skills: ${skills || "none listed"}`,
    `Summary: ${profile.summary}`,
  ]
    .filter(Boolean)
    .join("\n")

  const jobs = top
    .map(({ match, job }, i) =>
      [
        `[${i}] ${job.title} — ${job.company} (${job.location}${job.remote ? ", remote" : ""}; ${job.type}, ${job.level} level)`,
        `Skills you share: ${match.matchedSkills.join(", ") || "none detected"}`,
        `Skills in the listing you lack: ${match.missingSkills.join(", ") || "none detected"}`,
        job.description.slice(0, 700).replace(/\s+/g, " "),
      ].join("\n")
    )
    .join("\n\n")

  return `CANDIDATE\n${candidate}\n\nJOBS\n${jobs}`
}

/**
 * Explanations for the given matches, by index. Tries each configured
 * provider once (primary first); returns null when none gives a valid reply.
 */
export async function explainMatches(
  profile: MatchProfile,
  top: { match: ScoredMatch; job: Doc<"jobs"> }[]
): Promise<{
  explanations: Map<number, Explanation>
  provider: string
} | null> {
  if (top.length === 0) return { explanations: new Map(), provider: "none" }
  const prompt = buildPrompt(profile, top)

  for (const ai of getAIProviders()) {
    try {
      const reply = await withTimeout(
        ai.generateText({
          system: SYSTEM,
          prompt,
          json: true,
          temperature: 0.2,
          reasoning: "low",
          feature: "explain",
          timeoutMs: TIMEOUT_MS,
          attempts: 2,
        }),
        TIMEOUT_MS
      )
      const parsed = replySchema.safeParse(JSON.parse(stripFences(reply)))
      if (!parsed.success) {
        console.warn(`[matches] ${ai.name} explanation failed validation`)
        continue
      }
      const explanations = new Map<number, Explanation>()
      for (const item of parsed.data.items) {
        if (item.i < 0 || item.i >= top.length) continue
        explanations.set(item.i, {
          reason: item.reason.trim().slice(0, MAX_REASON),
          missingSkills: cleanSkills(item.missingSkills),
        })
      }
      if (explanations.size === 0) continue
      return { explanations, provider: `${ai.name}/${ai.model}` }
    } catch (error) {
      console.warn(
        `[matches] ${ai.name} explanation failed:`,
        safeErrorMessage(error)
      )
    }
  }
  return null
}

/** A reason built from the scores alone (when the AI call fails). */
export function ruleReason(match: ScoredMatch, job: Doc<"jobs">): string {
  const parts: string[] = []
  if (match.matchedSkills.length > 0) {
    const shown = match.matchedSkills.slice(0, 4).join(", ")
    const more = match.matchedSkills.length > 4 ? " and more" : ""
    parts.push(`Uses your skills in ${shown}${more}.`)
  } else {
    parts.push("Similar to your background and goals.")
  }
  if (match.preferenceFit >= 0.75) {
    parts.push(`Fits your preferences${job.remote ? " (remote)" : ""}.`)
  }
  return parts.join(" ")
}

function cleanSkills(names: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    const tidy = tidySkillName(raw)
    if (!tidy) continue
    const name = aliasFor(tidy) ?? tidy
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out.slice(0, 5)
}

function stripFences(reply: string) {
  const trimmed = reply.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
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
