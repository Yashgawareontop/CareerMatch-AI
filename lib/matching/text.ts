import type { Doc } from "@/convex/_generated/dataModel"

import type { MatchProfile } from "./types"

const JOB_DESCRIPTION_CHARS = 1500

type JobForText = Pick<
  Doc<"jobs">,
  | "title"
  | "company"
  | "location"
  | "remote"
  | "type"
  | "level"
  | "skills"
  | "description"
>

/** Non-empty header lines, a blank line, then the body. */
function block(lines: (string | false)[], body: string) {
  const head = lines.filter((l): l is string => Boolean(l)).join("\n")
  return body ? `${head}\n\n${body}` : head
}

/** The text a job listing is embedded from (stored once per job). */
export function jobEmbeddingText(job: JobForText): string {
  const level = job.level === "unknown" ? "" : `, ${job.level} level`
  return block(
    [
      job.title,
      `${job.company} · ${job.location}${job.remote ? " · Remote" : ""}`,
      `${job.type}${level}`,
      job.skills.length > 0 && `Skills: ${job.skills.join(", ")}`,
    ],
    job.description.slice(0, JOB_DESCRIPTION_CHARS)
  )
}

/** Target roles from the resume, the saved preferences, and the analysis. */
export function profileRoles(profile: MatchProfile): string[] {
  return unique([
    ...profile.careerGoals.targetRoles,
    ...(profile.preferences?.preferredRoles ?? []),
    ...profile.inferredRoles,
  ]).slice(0, 8)
}

/** Preferred job types from the resume goals and the saved preferences. */
export function profileJobTypes(profile: MatchProfile) {
  return [
    ...new Set([
      ...profile.careerGoals.jobTypes,
      ...(profile.preferences?.jobTypes ?? []),
    ]),
  ]
}

/** Preferred locations from the saved profile and the resume goals. */
export function profileLocations(profile: MatchProfile): string[] {
  return unique([
    ...(profile.preferences?.location ? [profile.preferences.location] : []),
    ...profile.careerGoals.locations,
  ])
}

/**
 * The text a user profile is embedded from: what they want (roles, type,
 * level) first, then what they can do (skills), so it reads like the job
 * listings it should land near.
 */
export function profileEmbeddingText(profile: MatchProfile): string {
  const roles = profileRoles(profile)
  const types = profileJobTypes(profile)
  const skills = profile.skills
    .filter((s) => s.category !== "soft")
    .slice(0, 40)
    .map((s) => s.name)
  const industries = unique([
    ...profile.careerGoals.industries,
    ...(profile.preferences?.targetIndustries ?? []),
  ])
  return block(
    [
      roles.length > 0 && `Looking for: ${roles.join(", ")}`,
      `Seniority: ${profile.seniority}${types.length ? ` · ${types.join(", ")}` : ""}`,
      skills.length > 0 && `Skills: ${skills.join(", ")}`,
      industries.length > 0 && `Industries: ${industries.join(", ")}`,
      Boolean(profile.careerGoals.statedGoal) &&
        `Goal: ${profile.careerGoals.statedGoal}`,
    ],
    profile.summary
  )
}

function unique(values: string[]) {
  const seen = new Set<string>()
  return values.filter((v) => {
    const key = v.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
