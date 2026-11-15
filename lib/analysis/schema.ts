import type { Infer } from "convex/values"
import { z } from "zod"

import type { analysisResultValidator, skillValidator } from "@/convex/schema"

/*
 * Zod schemas for the AI's analysis reply. Parsing is lenient about form
 * (nulls, synonyms like "database" → "tool", stray whitespace, overlong
 * lists) but strict about substance: a reply without the required sections,
 * or with values we can't map, fails and is retried with the error.
 */

export const SKILL_CATEGORIES = [
  "language",
  "framework",
  "tool",
  "cloud",
  "soft",
] as const
export const SKILL_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
] as const
export const SENIORITIES = [
  "student",
  "intern",
  "junior",
  "mid",
  "senior",
] as const

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.replace(/\s+/g, " ").slice(0, max))

/** An optional string: null, "", "N/A" and the like become undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((s) => {
      const t = s?.trim().replace(/\s+/g, " ")
      if (!t || /^(n\/?a|none|null|unknown|-)$/i.test(t)) return undefined
      return t.slice(0, max)
    })

/** A list that may be missing; empty strings are dropped, length is capped. */
const list = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(z.unknown())
    .nullish()
    .transform((items, ctx): z.output<T>[] => {
      const out: z.output<T>[] = []
      for (const [i, raw] of (items ?? []).entries()) {
        if (raw === null || raw === "") continue
        const parsed = item.safeParse(raw)
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            ctx.addIssue({
              code: "custom",
              message: issue.message,
              path: [i, ...issue.path],
            })
          }
          continue
        }
        out.push(parsed.data)
      }
      return out.slice(0, max)
    })

const textList = (maxItems: number, maxLength: number) =>
  list(text(maxLength), maxItems)

/** Maps common synonyms onto an enum before validating it. */
const mappedEnum = <const T extends readonly [string, ...string[]]>(
  values: T,
  synonyms: Record<string, T[number]>
) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value
    const key = value
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
    return synonyms[key] ?? key
  }, z.enum(values))

const category = mappedEnum(SKILL_CATEGORIES, {
  "programming-language": "language",
  languages: "language",
  "scripting-language": "language",
  "query-language": "language",
  library: "framework",
  libraries: "framework",
  frameworks: "framework",
  database: "tool",
  databases: "tool",
  tools: "tool",
  devops: "tool",
  platform: "tool",
  technology: "tool",
  concept: "tool",
  methodology: "tool",
  "cloud-platform": "cloud",
  "cloud-service": "cloud",
  "soft-skill": "soft",
  "soft-skills": "soft",
  interpersonal: "soft",
})

const level = mappedEnum(SKILL_LEVELS, {
  basic: "beginner",
  novice: "beginner",
  familiar: "beginner",
  elementary: "beginner",
  proficient: "intermediate",
  working: "intermediate",
  competent: "intermediate",
  strong: "advanced",
  experienced: "advanced",
  master: "expert",
})

const seniority = mappedEnum(SENIORITIES, {
  fresher: "student",
  undergraduate: "student",
  graduate: "junior",
  "new-grad": "junior",
  entry: "junior",
  "entry-level": "junior",
  associate: "junior",
  internship: "intern",
  trainee: "intern",
  "mid-level": "mid",
  intermediate: "mid",
  lead: "senior",
  staff: "senior",
  principal: "senior",
})

/** A 4-digit year from 2026, "2026", "Expected May 2026", …, else undefined. */
const year = z.unknown().transform((value) => {
  const match = String(value ?? "").match(/\b(19[5-9]\d|20\d\d|2100)\b/)
  return match ? Number(match[1]) : undefined
})

export const aiSkillSchema = z.object({
  name: text(80),
  category,
  level: level.catch("intermediate"),
  evidence: optionalText(300).transform((s) => s ?? "Listed in resume"),
})

/** The shape the model is asked to return (see prompt.ts). */
export const aiAnalysisSchema = z.object({
  skills: list(aiSkillSchema, 120).refine((s) => s.length > 0, {
    message: "Expected at least one skill",
  }),
  experience: list(
    z.object({
      title: text(120),
      organization: optionalText(120).transform((s) => s ?? "Unknown"),
      startDate: optionalText(30),
      endDate: optionalText(30),
      highlights: textList(6, 300),
    }),
    20
  ),
  projects: list(
    z.object({
      name: text(120),
      description: optionalText(500).transform((s) => s ?? ""),
      technologies: textList(20, 60),
    }),
    20
  ),
  education: list(
    z.object({
      institution: text(160),
      degree: optionalText(160).transform((s) => s ?? ""),
      field: optionalText(120),
      graduationYear: year,
    }),
    10
  ),
  seniority,
  inferredRoles: textList(8, 80),
  careerGoals: z
    .object({
      targetRoles: textList(10, 80),
      industries: textList(10, 80),
      locations: textList(10, 80),
      statedGoal: optionalText(500),
    })
    .nullish()
    .transform(
      (g) =>
        g ?? {
          targetRoles: [],
          industries: [],
          locations: [],
          statedGoal: undefined,
        }
    ),
  summary: text(1200),
  strengths: textList(8, 300),
  gaps: textList(8, 300),
})

export type AIAnalysis = z.output<typeof aiAnalysisSchema>

/** What gets stored in Convex (`analyses.result`). */
export type AnalysisResult = Infer<typeof analysisResultValidator>
export type Skill = Infer<typeof skillValidator>

// Compile-time check that the Zod output still fits the Convex validator.
type AISkillFitsStored =
  z.output<typeof aiSkillSchema> extends Omit<Skill, "escoUri"> ? true : never
const aiSkillFitsStored: AISkillFitsStored = true
void aiSkillFitsStored
