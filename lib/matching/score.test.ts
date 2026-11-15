import { describe, expect, test } from "vitest"

import type { Doc, Id } from "@/convex/_generated/dataModel"

import {
  agePenalty,
  preferenceContext,
  preferenceFit,
  rankCandidates,
  semanticScore,
  skillOverlap,
  WEIGHTS,
} from "./score"
import type { MatchProfile } from "./types"

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 15)

let n = 0
function job(fields: Partial<Doc<"jobs">> = {}): Doc<"jobs"> {
  n++
  return {
    _id: `job${n}` as Id<"jobs">,
    _creationTime: NOW,
    source: "remotive",
    externalId: String(n),
    dedupeKey: `k${n}`,
    title: "Frontend Developer Intern",
    company: "Fieldnote",
    location: "Remote",
    remote: true,
    type: "internship",
    level: "intern",
    description: "",
    skills: ["React", "TypeScript"],
    url: "https://example.com",
    postedAt: NOW,
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    ...fields,
  }
}

const profile: MatchProfile = {
  skills: [
    { name: "React", category: "framework", level: "advanced", evidence: "" },
    {
      name: "TypeScript",
      category: "language",
      level: "advanced",
      evidence: "",
    },
    { name: "Postgres", category: "tool", level: "intermediate", evidence: "" },
  ],
  seniority: "student",
  inferredRoles: ["Frontend Developer"],
  summary: "",
  careerGoals: {
    targetRoles: ["Frontend Developer"],
    industries: [],
    jobTypes: ["internship"],
    locations: ["Pune, India"],
  },
  preferences: null,
}

describe("semanticScore", () => {
  test("stretches the useful similarity band to 0–1", () => {
    expect(semanticScore(0.5)).toBe(0)
    expect(semanticScore(0.65)).toBeCloseTo(0.5)
    expect(semanticScore(0.9)).toBe(1)
  })
})

describe("skillOverlap", () => {
  test("matches through aliases and splits matched from missing", () => {
    const r = skillOverlap(
      ["React", "Postgres"],
      ["React", "PostgreSQL", "Docker"]
    )
    expect(r.matched).toEqual(["React", "PostgreSQL"])
    expect(r.missing).toEqual(["Docker"])
  })

  test("one shared skill out of one is not a perfect score", () => {
    expect(skillOverlap(["React"], ["React"]).score).toBe(0.25)
  })

  test("a listing without skills is neutral", () => {
    expect(skillOverlap(["React"], []).score).toBe(0.3)
  })
})

describe("preferenceFit", () => {
  const ctx = preferenceContext(profile)

  test("a remote frontend internship fits a frontend student best", () => {
    const fit = preferenceFit(job(), ctx)
    const senior = preferenceFit(
      job({
        title: "Senior Backend Engineer",
        level: "senior",
        type: "full-time",
      }),
      ctx
    )
    expect(fit).toBeGreaterThan(0.9)
    expect(senior).toBeLessThan(0.4)
  })

  test("on-site jobs count only in a preferred location", () => {
    const pune = preferenceFit(
      job({ remote: false, location: "Pune, Maharashtra" }),
      ctx
    )
    const berlin = preferenceFit(
      job({ remote: false, location: "Berlin" }),
      ctx
    )
    expect(pune).toBeGreaterThan(berlin)
  })
})

describe("agePenalty", () => {
  test("grows with age and caps at 30 days", () => {
    expect(agePenalty(NOW, NOW)).toBe(0)
    expect(agePenalty(NOW - 15 * DAY, NOW)).toBeCloseTo(0.05)
    expect(agePenalty(NOW - 90 * DAY, NOW)).toBeCloseTo(0.1)
  })
})

describe("rankCandidates", () => {
  test("ranks by the weighted score, best first, from rank 1", () => {
    expect(WEIGHTS.semantic + WEIGHTS.skills + WEIGHTS.preferences).toBeCloseTo(
      1
    )
    const good = job()
    const poor = job({
      title: "Senior Data Engineer",
      level: "senior",
      skills: ["Spark"],
    })
    const ranked = rankCandidates(
      [
        { job: poor, similarity: 0.6 },
        { job: good, similarity: 0.72 },
      ],
      profile,
      { now: NOW }
    )
    expect(ranked.map((m) => m.jobId)).toEqual([good._id, poor._id])
    expect(ranked.map((m) => m.rank)).toEqual([1, 2])
    expect(ranked[0].matchedSkills).toEqual(["React", "TypeScript"])
    for (const m of ranked) {
      expect(m.score).toBeGreaterThanOrEqual(0)
      expect(m.score).toBeLessThanOrEqual(1)
    }
  })

  test("drops dismissed jobs and reposts of the same role", () => {
    const a = job({ company: "Fieldnote" })
    const repost = job({ company: "Fieldnote Inc" })
    const dismissed = job({ title: "Web Developer Intern" })
    const ranked = rankCandidates(
      [
        { job: a, similarity: 0.7 },
        { job: repost, similarity: 0.69 },
        { job: dismissed, similarity: 0.75 },
      ],
      profile,
      { now: NOW, dismissed: [dismissed._id] }
    )
    expect(ranked.map((m) => m.jobId)).toEqual([a._id])
  })

  test("respects the limit", () => {
    // Distinct roles: titles that differ only by a digit count as reposts.
    const roles = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"]
    const many = roles.map((r) => ({
      job: job({ title: `Frontend ${r} Developer` }),
      similarity: 0.7,
    }))
    expect(rankCandidates(many, profile, { now: NOW, limit: 3 })).toHaveLength(
      3
    )
  })
})
