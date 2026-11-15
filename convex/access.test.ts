// Access audit (Phase 7): every resume, analysis, match and feedback row is
// visible and writable only by its owner; server-only functions need the
// server secret; signed-out callers get nothing.

import { describe, expect, test } from "vitest"

import {
  SECRET,
  setup,
  signedInUser,
  storedResume,
  type T,
} from "../tests/convex"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

const RESULT = {
  skills: [
    {
      name: "React",
      category: "framework" as const,
      level: "advanced" as const,
      evidence: "Built a course planner in React",
    },
  ],
  experience: [],
  projects: [],
  education: [],
  seniority: "student" as const,
  inferredRoles: ["Frontend Developer"],
  careerGoals: {
    targetRoles: ["Frontend Developer"],
    industries: [],
    jobTypes: ["internship" as const],
    locations: ["Pune"],
  },
  summary: "Student building web apps",
  strengths: ["React"],
  gaps: ["Testing"],
}

async function doneAnalysis(
  t: T,
  userId: Id<"users">,
  resumeId: Id<"resumes">
) {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("analyses", {
        resumeId,
        userId,
        status: "done",
        createdAt: Date.now(),
        promptVersion: "test",
        result: RESULT,
        skills: RESULT.skills,
      })
  )
}

async function aJob(t: T) {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("jobs", {
        source: "remotive",
        externalId: "1",
        dedupeKey: "k1",
        title: "Frontend Intern",
        company: "Fieldnote",
        location: "Remote",
        remote: true,
        type: "internship",
        level: "intern",
        description: "React",
        skills: ["React"],
        url: "https://example.com/job",
        postedAt: Date.now(),
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
      })
  )
}

describe("resumes", () => {
  test("another user cannot read, delete or parse my resume", async () => {
    const t = setup()
    const alice = await signedInUser(t)
    const bob = await signedInUser(t)
    const resumeId = await storedResume(t, alice.userId, {
      status: "parsed",
      rawText: "Alice's private resume",
    })

    expect(
      await alice.as.query(api.resumes.getMine, { resumeId })
    ).toMatchObject({
      rawText: "Alice's private resume",
    })
    expect(await bob.as.query(api.resumes.getMine, { resumeId })).toBeNull()
    expect(await bob.as.query(api.resumes.listMine, {})).toEqual([])

    await expect(
      bob.as.mutation(api.resumes.remove, { resumeId })
    ).rejects.toThrow(/Resume not found/)
    await expect(
      bob.as.mutation(api.resumes.startParsing, { resumeId })
    ).rejects.toThrow(/Resume not found/)

    // Still there for Alice.
    expect(await alice.as.query(api.resumes.listMine, {})).toHaveLength(1)
  })

  test("signed-out callers get nothing", async () => {
    const t = setup()
    const alice = await signedInUser(t)
    const resumeId = await storedResume(t, alice.userId)
    expect(await t.query(api.resumes.getMine, { resumeId })).toBeNull()
    expect(await t.query(api.resumes.listMine, {})).toEqual([])
    await expect(t.mutation(api.resumes.generateUploadUrl, {})).rejects.toThrow(
      /Not signed in/
    )
  })

  test("only the server can write parsed text", async () => {
    const t = setup()
    const alice = await signedInUser(t)
    const resumeId = await storedResume(t, alice.userId)
    const { attempt } = await alice.as.mutation(api.resumes.startParsing, {
      resumeId,
    })

    await expect(
      alice.as.mutation(api.resumes.completeParsing, {
        secret: "wrong-secret",
        resumeId,
        attempt,
        rawText: "Injected text",
        parseMethod: "pdf",
      })
    ).rejects.toThrow(/Forbidden/)

    await t.mutation(api.resumes.completeParsing, {
      secret: SECRET,
      resumeId,
      attempt,
      rawText: "Real text",
      parseMethod: "pdf",
    })
    expect(
      await alice.as.query(api.resumes.getMine, { resumeId })
    ).toMatchObject({
      status: "parsed",
      rawText: "Real text",
    })
  })
})

describe("analyses", () => {
  test("another user cannot read or edit my analysis", async () => {
    const t = setup()
    const alice = await signedInUser(t)
    const bob = await signedInUser(t)
    const resumeId = await storedResume(t, alice.userId, { status: "parsed" })
    const analysisId = await doneAnalysis(t, alice.userId, resumeId)

    expect(
      await alice.as.query(api.analyses.getMine, { analysisId })
    ).not.toBeNull()
    expect(await bob.as.query(api.analyses.getMine, { analysisId })).toBeNull()
    expect(
      await bob.as.query(api.analyses.latestForMyResume, { resumeId })
    ).toBeNull()
    expect(
      await bob.as.query(api.analyses.historyForMyResume, { resumeId })
    ).toEqual([])
    expect(await bob.as.query(api.analyses.latestDoneMine, {})).toBeNull()

    await expect(
      bob.as.mutation(api.analyses.updateSkills, { analysisId, skills: [] })
    ).rejects.toThrow()
    await expect(
      bob.as.mutation(api.analyses.start, { resumeId, promptVersion: "x" })
    ).rejects.toThrow()

    const mine = await alice.as.query(api.analyses.getMine, { analysisId })
    expect(mine?.skills).toHaveLength(1)
  })

  test("an analysis result needs the server secret", async () => {
    const t = setup()
    const alice = await signedInUser(t)
    const resumeId = await storedResume(t, alice.userId, { status: "parsed" })
    const analysisId = await doneAnalysis(t, alice.userId, resumeId)
    await expect(
      alice.as.mutation(api.analyses.fail, {
        secret: "nope",
        analysisId,
        error: "x",
      })
    ).rejects.toThrow(/Forbidden/)
  })
})

describe("matches and feedback", () => {
  test("feedback is per user", async () => {
    const t = setup()
    const alice = await signedInUser(t)
    const bob = await signedInUser(t)
    const jobId = await aJob(t)

    await alice.as.mutation(api.matches.setFeedback, { jobId, status: "saved" })
    expect(
      await alice.as.query(api.matches.myFeedback, { status: "saved" })
    ).toHaveLength(1)
    expect(
      await bob.as.query(api.matches.myFeedback, { status: "saved" })
    ).toEqual([])
    expect(await bob.as.query(api.matches.forJob, { jobId })).toEqual({
      match: null,
      feedback: null,
    })
    // Bob clearing "his" feedback must not touch Alice's.
    await bob.as.mutation(api.matches.setFeedback, { jobId, status: null })
    expect(
      await alice.as.query(api.matches.myFeedback, { status: "saved" })
    ).toHaveLength(1)
  })

  test("a user only sees their own matches", async () => {
    const t = setup()
    const alice = await signedInUser(t)
    const bob = await signedInUser(t)
    const jobId = await aJob(t)
    const resumeId = await storedResume(t, alice.userId, { status: "parsed" })
    const analysisId = await doneAnalysis(t, alice.userId, resumeId)
    await t.run(async (ctx) => {
      const runId = await ctx.db.insert("matchRuns", {
        userId: alice.userId,
        status: "done",
        startedAt: Date.now(),
        analysisId,
      })
      await ctx.db.insert("matches", {
        userId: alice.userId,
        runId,
        jobId,
        rank: 1,
        score: 0.8,
        semantic: 0.8,
        skillOverlap: 0.5,
        preferenceFit: 1,
        agePenalty: 0,
        matchedSkills: ["React"],
        missingSkills: [],
        reason: "Fits",
      })
    })

    const mine = await alice.as.query(api.matches.mine, {})
    expect(mine.matches).toHaveLength(1)
    const theirs = await bob.as.query(api.matches.mine, {})
    expect(theirs.matches).toEqual([])
    expect((await bob.as.query(api.matches.forJob, { jobId })).match).toBeNull()
  })

  test("match results need the server secret", async () => {
    const t = setup()
    const alice = await signedInUser(t)
    const resumeId = await storedResume(t, alice.userId, { status: "parsed" })
    const analysisId = await doneAnalysis(t, alice.userId, resumeId)
    const runId = await t.run(
      async (ctx) =>
        await ctx.db.insert("matchRuns", {
          userId: alice.userId,
          status: "running",
          startedAt: Date.now(),
          analysisId,
        })
    )
    await expect(
      alice.as.mutation(api.matches.fail, { secret: "nope", runId, error: "x" })
    ).rejects.toThrow(/Forbidden/)
  })
})

describe("server-only functions", () => {
  test("reject a wrong secret", async () => {
    const t = setup()
    await expect(
      t.query(api.jobs.knownIds, { secret: "nope", items: [] })
    ).rejects.toThrow(/Forbidden/)
    await expect(
      t.mutation(api.jobs.upsertBatch, { secret: "nope", jobs: [] })
    ).rejects.toThrow(/Forbidden/)
    await expect(
      t.query(api.jobs.recentRuns, { secret: "nope" })
    ).rejects.toThrow(/Forbidden/)
    await expect(
      t.query(api.skillCache.lookup, { secret: "nope", keys: [] })
    ).rejects.toThrow(/Forbidden/)
    await expect(
      t.query(api.aiCalls.summary, { secret: "nope", since: 0 })
    ).rejects.toThrow(/Forbidden/)
    await expect(
      t.mutation(api.aiCalls.record, {
        secret: "nope",
        call: {
          at: 0,
          provider: "groq",
          model: "m",
          feature: "f",
          ms: 1,
          ok: true,
          attempt: 1,
        },
      })
    ).rejects.toThrow(/Forbidden/)
  })

  test("accept the right one", async () => {
    const t = setup()
    expect(
      await t.query(api.jobs.knownIds, { secret: SECRET, items: [] })
    ).toEqual([])
  })
})

describe("account deletion", () => {
  test("removes my data and leaves other users alone", async () => {
    const t = setup()
    const alice = await signedInUser(t)
    const bob = await signedInUser(t)
    const jobId = await aJob(t)
    const aliceResume = await storedResume(t, alice.userId, {
      status: "parsed",
    })
    await doneAnalysis(t, alice.userId, aliceResume)
    await alice.as.mutation(api.matches.setFeedback, {
      jobId,
      status: "applied",
    })
    const bobResume = await storedResume(t, bob.userId)

    await alice.as.mutation(api.account.deleteMine, {})

    const left = await t.run(async (ctx) => ({
      resumes: await ctx.db.query("resumes").collect(),
      analyses: await ctx.db.query("analyses").collect(),
      feedback: await ctx.db.query("jobFeedback").collect(),
      users: await ctx.db.query("users").collect(),
    }))
    expect(left.resumes.map((r) => r._id)).toEqual([bobResume])
    expect(left.analyses).toEqual([])
    expect(left.feedback).toEqual([])
    expect(left.users.map((u) => u._id)).toEqual([bob.userId])
    // Alice's session was revoked, so she is signed out.
    expect(await alice.as.query(api.resumes.listMine, {})).toEqual([])
  })
})

describe("usage", () => {
  test("service usage is admin only", async () => {
    const t = setup()
    const alice = await signedInUser(t)
    const admin = await signedInUser(t)
    process.env.ADMIN_USER_IDS = `someone-else, ${admin.userId}`
    expect(await alice.as.query(api.usage.service, { since: 0 })).toBeNull()
    expect(await t.query(api.usage.service, { since: 0 })).toBeNull()
    expect(await admin.as.query(api.usage.service, { since: 0 })).toMatchObject(
      {
        total: 0,
      }
    )
    delete process.env.ADMIN_USER_IDS
  })

  test("my limits start full and use up as I act", async () => {
    const t = setup()
    const alice = await signedInUser(t)
    const before = await alice.as.query(api.usage.myLimits, {})
    const upload = before?.find((l) => l.name === "resumeUpload")
    expect(upload).toMatchObject({ ts: 0, value: upload?.capacity })

    await alice.as.mutation(api.resumes.generateUploadUrl, {})
    const after = await alice.as.query(api.usage.myLimits, {})
    const used = after?.find((l) => l.name === "resumeUpload")
    expect(used!.value).toBe(upload!.capacity - 1)
    expect(await t.query(api.usage.myLimits, {})).toBeNull()
  })
})
