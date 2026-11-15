import "server-only"

import { z } from "zod"

import { getCheapProvider } from "@/lib/ai"
import { safeErrorMessage } from "@/lib/ai/redact"

import type { JobKind, JobLevel, RawJob } from "./types"

// Level / type: keyword rules first; only listings the rules can't place go
// to one cheap batched AI call (small Groq model). Capped per sync so a sync
// never burns more than a few requests of the free quota.

const AI_BATCH = 30
const MAX_AI_BATCHES = 3

const INTERN =
  /\b(intern|interns|internship|praktikum|praktikant(in)?|werkstudent(in)?|working student|co-?op|summer analyst)\b/i
const ENTRY =
  /\b(trainee|graduate|grad|fresher|freshers|entry[- ]level|junior|jr\.?|apprentice(ship)?|ausbildung|new grad|early career|associate engineer|associate developer)\b/i
const SENIOR =
  /\b(senior|sr\.?|lead|principal|staff|head of|director|vp|vice president|manager|architect|chief|cto|expert)\b/i
const MID = /\b(mid[- ]?level|intermediate|mid[- ]senior)\b/i

/** The level from keyword rules and the source's hint, or null if unclear. */
export function ruleLevel(title: string, hint?: JobLevel): JobLevel | null {
  if (INTERN.test(title) || hint === "intern") return "intern"
  if (hint && hint !== "unknown") return hint
  if (ENTRY.test(title)) return "entry"
  if (SENIOR.test(title)) return "senior"
  if (MID.test(title)) return "mid"
  return null
}

export function ruleType(job: RawJob, level: JobLevel): JobKind {
  if (level === "intern") return "internship"
  if (job.typeHint) return job.typeHint
  if (/\b(part[- ]time|teilzeit)\b/i.test(job.title)) return "part-time"
  if (/\b(contract|contractor|freelance|freelancer)\b/i.test(job.title))
    return "contract"
  return "full-time"
}

const aiReply = z.object({
  items: z.array(
    z.object({
      i: z.number().int(),
      level: z.enum(["intern", "entry", "mid", "senior"]),
    })
  ),
})

const SYSTEM = `You label job listings by seniority. For each listing reply with one level:
- "intern": internship, working student, placement
- "entry": 0-2 years, graduate, junior, trainee
- "mid": 2-5 years
- "senior": 5+ years, lead, staff, principal, manager
Use the years of experience asked for when stated. Reply with JSON only:
{"items":[{"i":0,"level":"entry"}]}`

/**
 * Asks the cheap model for the level of each listing. Returns index → level
 * for the ones it answered, and how many requests it made.
 */
export async function aiLevels(
  jobs: { title: string; description: string }[]
): Promise<{ levels: Map<number, JobLevel>; calls: number }> {
  const levels = new Map<number, JobLevel>()
  const ai = getCheapProvider()
  if (!ai || jobs.length === 0) return { levels, calls: 0 }

  let calls = 0
  const limit = Math.min(jobs.length, AI_BATCH * MAX_AI_BATCHES)
  for (let start = 0; start < limit; start += AI_BATCH) {
    const batch = jobs.slice(start, Math.min(start + AI_BATCH, limit))
    const prompt = batch
      .map(
        (job, k) =>
          `[${k}] ${job.title}\n${job.description.slice(0, 400).replace(/\s+/g, " ")}`
      )
      .join("\n\n")
    calls++
    try {
      const reply = await ai.generateText({
        system: SYSTEM,
        prompt,
        json: true,
        temperature: 0,
        reasoning: "minimal",
        feature: "classify",
      })
      const parsed = aiReply.safeParse(JSON.parse(reply))
      if (!parsed.success) {
        console.warn("[jobs] AI classification reply failed validation")
        continue
      }
      for (const { i, level } of parsed.data.items) {
        if (i >= 0 && i < batch.length) levels.set(start + i, level)
      }
    } catch (error) {
      console.warn("[jobs] AI classification failed:", safeErrorMessage(error))
      break // Likely a rate limit; don't spend more requests this run.
    }
  }
  return { levels, calls }
}
