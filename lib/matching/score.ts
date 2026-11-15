import type { Doc } from "@/convex/_generated/dataModel"
import { aliasFor, skillKey } from "@/convex/skillNames"

import { profileJobTypes, profileLocations, profileRoles } from "./text"
import type { Candidate, MatchProfile, ScoredMatch } from "./types"

// Ranking step 2: combine semantic similarity, skill overlap and preference
// fit, minus a small penalty for older listings. Pure functions (no I/O).

const DAY = 24 * 60 * 60 * 1000

export const WEIGHTS = { semantic: 0.5, skills: 0.2, preferences: 0.3 }
/** Largest age penalty, reached at MAX_AGE_DAYS. */
const MAX_AGE_PENALTY = 0.1
const MAX_AGE_DAYS = 30
/**
 * Skill overlap is matched / max(this, skills in the listing), so a listing
 * that names one skill you have isn't a "100%" skill match.
 */
const MIN_SKILL_DENOMINATOR = 4
const MAX_MISSING = 6

/**
 * Profile-to-listing cosine similarities from gemini-embedding-001 sit in a
 * narrow band (about 0.55 unrelated to 0.75 very close, measured on real
 * data), so they are stretched to 0–1 over that band.
 */
const SIM_FLOOR = 0.55
const SIM_CEIL = 0.75

type Seniority = MatchProfile["seniority"]
type JobLevel = Doc<"jobs">["level"]

/** How well a listing's level suits the user's seniority (0–1). */
const LEVEL_FIT: Record<
  Seniority,
  Record<Exclude<JobLevel, "unknown">, number>
> = {
  student: { intern: 1, entry: 0.8, mid: 0.15, senior: 0 },
  intern: { intern: 1, entry: 0.85, mid: 0.2, senior: 0 },
  junior: { intern: 0.6, entry: 1, mid: 0.5, senior: 0.1 },
  mid: { intern: 0.1, entry: 0.6, mid: 1, senior: 0.6 },
  senior: { intern: 0, entry: 0.2, mid: 0.7, senior: 1 },
}

const ROLE_STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "of",
  "in",
  "to",
  "with",
  "a",
  "an",
  "intern",
  "internship",
  "junior",
  "senior",
  "jr",
  "sr",
  "remote",
  "m",
  "w",
  "d",
])

const clamp = (n: number) => Math.min(1, Math.max(0, n))
const round = (n: number) => Math.round(n * 1000) / 1000

function tokens(text: string) {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter((t) => t.length > 1 && !ROLE_STOPWORDS.has(t))
}

export function semanticScore(similarity: number) {
  return clamp((similarity - SIM_FLOOR) / (SIM_CEIL - SIM_FLOOR))
}

/** Matched and missing job skills, by canonical name. */
export function skillOverlap(userSkills: string[], jobSkills: string[]) {
  const have = new Set(userSkills.map((s) => skillKey(aliasFor(s) ?? s)))
  const matched: string[] = []
  const missing: string[] = []
  for (const skill of jobSkills) {
    if (have.has(skillKey(skill))) matched.push(skill)
    else missing.push(skill)
  }
  // A listing that names no skills is neither a good nor a bad sign.
  const score =
    jobSkills.length === 0
      ? 0.3
      : clamp(
          matched.length / Math.max(MIN_SKILL_DENOMINATOR, jobSkills.length)
        )
  return { score, matched, missing }
}

export interface PreferenceContext {
  seniority: Seniority
  jobTypes: ReturnType<typeof profileJobTypes>
  locations: string[]
  roles: string[]
}

export function preferenceContext(profile: MatchProfile): PreferenceContext {
  return {
    seniority: profile.seniority,
    jobTypes: profileJobTypes(profile),
    locations: profileLocations(profile),
    roles: profileRoles(profile),
  }
}

/** Type, level, location and role-title fit, each 0–1, weighted into one. */
export function preferenceFit(job: Doc<"jobs">, ctx: PreferenceContext) {
  const type =
    ctx.jobTypes.length === 0
      ? 0.5
      : ctx.jobTypes.some(
            (t) =>
              (t === "remote" && job.remote) ||
              (t === "internship" && job.type === "internship") ||
              (t === "full-time" && job.type === "full-time")
          )
        ? 1
        : 0

  const level =
    job.level === "unknown" ? 0.5 : LEVEL_FIT[ctx.seniority][job.level]

  let location = 0.5
  if (job.remote) location = 1
  else if (ctx.locations.length > 0) {
    const where = job.location.toLowerCase()
    location = ctx.locations.some((l) =>
      l
        .toLowerCase()
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 1 && part !== "remote")
        .some((part) => where.includes(part))
    )
      ? 1
      : 0.15
  }

  const titleTokens = new Set(tokens(job.title))
  let role = 0.3
  for (const r of ctx.roles) {
    const want = tokens(r)
    if (want.length === 0) continue
    const hit = want.filter((t) => titleTokens.has(t)).length / want.length
    role = Math.max(role, hit)
  }

  // Role words in the title weigh most: they say what the job actually is.
  return 0.25 * type + 0.25 * level + 0.15 * location + 0.35 * role
}

export function agePenalty(postedAt: number, now: number) {
  const days = Math.max(0, (now - postedAt) / DAY)
  return MAX_AGE_PENALTY * Math.min(1, days / MAX_AGE_DAYS)
}

/** Same title and place: one listing reposted under variant company names. */
function repostKey(job: Doc<"jobs">) {
  const norm = (t: string) => tokens(t).join(" ")
  return `${norm(job.title)}|${norm(job.location)}`
}

/**
 * Scores and ranks recall candidates. Dismissed jobs and reposts (same title
 * and location, keeping the best-scored) are dropped. Returns
 * at most `limit` matches, best first, with rank starting at 1.
 */
export function rankCandidates(
  candidates: Candidate[],
  profile: MatchProfile,
  options: { now: number; dismissed?: Iterable<string>; limit?: number }
): ScoredMatch[] {
  const dismissed = new Set(options.dismissed ?? [])
  const ctx = preferenceContext(profile)
  const userSkills = profile.skills.map((s) => s.name)

  const scored = candidates
    .filter((c) => !dismissed.has(c.job._id))
    .map(({ job, similarity }) => {
      const semantic = semanticScore(similarity)
      const skills = skillOverlap(userSkills, job.skills)
      const fit = preferenceFit(job, ctx)
      const penalty = agePenalty(job.postedAt, options.now)
      const score =
        WEIGHTS.semantic * semantic +
        WEIGHTS.skills * skills.score +
        WEIGHTS.preferences * fit -
        penalty
      return {
        jobId: job._id,
        rank: 0,
        score: round(score),
        semantic: round(semantic),
        skillOverlap: round(skills.score),
        preferenceFit: round(fit),
        agePenalty: round(penalty),
        matchedSkills: skills.matched,
        missingSkills: skills.missing.slice(0, MAX_MISSING),
      } satisfies ScoredMatch
    })
    .sort((a, b) => b.score - a.score)

  const jobs = new Map(candidates.map((c) => [c.job._id, c.job]))
  const seen = new Set<string>()
  const unique = scored
    .filter((m) => {
      const key = repostKey(jobs.get(m.jobId)!)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, options.limit ?? 50)

  return unique.map((m, i) => ({ ...m, rank: i + 1 }))
}
