import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export const jobTypeValidator = v.union(
  v.literal("internship"),
  v.literal("full-time"),
  v.literal("remote")
)

export const profileFields = {
  name: v.string(),
  education: v.string(),
  graduationYear: v.number(),
  location: v.string(),
  preferredRoles: v.array(v.string()),
  jobTypes: v.array(jobTypeValidator),
  targetIndustries: v.array(v.string()),
}

export const resumeStatusValidator = v.union(
  v.literal("uploaded"),
  v.literal("parsing"),
  v.literal("parsed"),
  v.literal("failed")
)

// ── Resume analysis (Phase 3) ────────────────────────────────
// Mirrors the Zod schema in lib/analysis/schema.ts (a type check there keeps
// the two in sync). The route validates AI output with Zod before storing it.

export const skillCategoryValidator = v.union(
  v.literal("language"),
  v.literal("framework"),
  v.literal("tool"),
  v.literal("cloud"),
  v.literal("soft")
)

export const skillLevelValidator = v.union(
  v.literal("beginner"),
  v.literal("intermediate"),
  v.literal("advanced"),
  v.literal("expert")
)

export const skillValidator = v.object({
  name: v.string(),
  category: skillCategoryValidator,
  level: skillLevelValidator,
  /** Where in the resume the skill shows up ("Added by you" for manual ones). */
  evidence: v.string(),
  /** ESCO concept URI, when the name was matched in ESCO. */
  escoUri: v.optional(v.string()),
})

export const seniorityValidator = v.union(
  v.literal("student"),
  v.literal("intern"),
  v.literal("junior"),
  v.literal("mid"),
  v.literal("senior")
)

export const analysisResultValidator = v.object({
  skills: v.array(skillValidator),
  experience: v.array(
    v.object({
      title: v.string(),
      organization: v.string(),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      highlights: v.array(v.string()),
    })
  ),
  projects: v.array(
    v.object({
      name: v.string(),
      description: v.string(),
      technologies: v.array(v.string()),
    })
  ),
  education: v.array(
    v.object({
      institution: v.string(),
      degree: v.string(),
      field: v.optional(v.string()),
      graduationYear: v.optional(v.number()),
    })
  ),
  seniority: seniorityValidator,
  inferredRoles: v.array(v.string()),
  /** The resume's goals merged with the user's saved preferences. */
  careerGoals: v.object({
    targetRoles: v.array(v.string()),
    industries: v.array(v.string()),
    jobTypes: v.array(jobTypeValidator),
    locations: v.array(v.string()),
    /** Goals stated in the resume itself (objective / summary), if any. */
    statedGoal: v.optional(v.string()),
  }),
  summary: v.string(),
  strengths: v.array(v.string()),
  gaps: v.array(v.string()),
})

export const analysisStatusValidator = v.union(
  v.literal("running"),
  v.literal("done"),
  v.literal("failed")
)

// ── Job listings (Phase 4) ───────────────────────────────────
// Mirrors the Job shape in lib/jobs/types.ts (a type check there keeps the
// two in sync). Written only by the Next.js sync route (server secret).

export const jobSourceValidator = v.union(
  v.literal("adzuna"),
  v.literal("remotive"),
  v.literal("arbeitnow"),
  v.literal("jooble"),
  v.literal("himalayas"),
  v.literal("remoteok")
)

export const jobKindValidator = v.union(
  v.literal("internship"),
  v.literal("full-time"),
  v.literal("part-time"),
  v.literal("contract")
)

export const jobLevelValidator = v.union(
  v.literal("intern"),
  v.literal("entry"),
  v.literal("mid"),
  v.literal("senior"),
  v.literal("unknown")
)

export const jobFields = {
  source: jobSourceValidator,
  externalId: v.string(),
  title: v.string(),
  company: v.string(),
  location: v.string(),
  remote: v.boolean(),
  type: jobKindValidator,
  level: jobLevelValidator,
  /** Plain text (HTML stripped), truncated. */
  description: v.string(),
  /** Canonical skill names found in the title, tags and description. */
  skills: v.array(v.string()),
  salary: v.optional(
    v.object({
      min: v.optional(v.number()),
      max: v.optional(v.number()),
      currency: v.optional(v.string()),
      text: v.optional(v.string()),
    })
  ),
  url: v.string(),
  postedAt: v.number(),
}

export const syncSourceStatValidator = v.object({
  source: jobSourceValidator,
  /** HTTP requests made to the source (for free-quota tracking). */
  calls: v.number(),
  fetched: v.number(),
  kept: v.number(),
  skipped: v.optional(v.string()),
  error: v.optional(v.string()),
})

// ── Matching (Phase 5) ───────────────────────────────────────

export const matchRunStatusValidator = v.union(
  v.literal("running"),
  v.literal("done"),
  v.literal("failed")
)

export const feedbackStatusValidator = v.union(
  v.literal("saved"),
  v.literal("dismissed"),
  v.literal("applied")
)

/** One ranked recommendation. Scores are 0–1; written by lib/matching. */
export const matchFields = {
  jobId: v.id("jobs"),
  rank: v.number(),
  score: v.number(),
  semantic: v.number(),
  skillOverlap: v.number(),
  preferenceFit: v.number(),
  /** Subtracted from the score for older listings. */
  agePenalty: v.number(),
  matchedSkills: v.array(v.string()),
  missingSkills: v.array(v.string()),
  /** AI explanation (top 10 only), or a rule-based one when AI failed. */
  reason: v.optional(v.string()),
}

export const matchValidator = v.object(matchFields)

export default defineSchema({
  // App users. Credentials and sessions live in the Convex Auth components;
  // this table only holds the app's own user record.
  users: defineTable({
    signInMethod: v.string(),
  }),

  // One career-preferences profile per user.
  profiles: defineTable({
    userId: v.id("users"),
    ...profileFields,
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Uploaded resumes and their extracted plain text (Phase 2).
  resumes: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    status: resumeStatusValidator,
    rawText: v.optional(v.string()),
    error: v.optional(v.string()),
    // Set when parsing starts, so a crashed parse can be retried later.
    parseStartedAt: v.optional(v.number()),
    // "pdf" | "docx" | "pdf-ocr": how the text was extracted.
    parseMethod: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_storageId", ["storageId"]),

  // AI analyses of a resume (Phase 3). Each run adds a row; earlier rows stay
  // as history. `result` is what the model returned (validated, skill names
  // cleaned); `skills` is the user-confirmed list that later phases use.
  analyses: defineTable({
    resumeId: v.id("resumes"),
    userId: v.id("users"),
    status: analysisStatusValidator,
    createdAt: v.number(),
    /** Version of the prompt in lib/analysis/prompt.ts, for reproducibility. */
    promptVersion: v.string(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    result: v.optional(analysisResultValidator),
    skills: v.optional(v.array(skillValidator)),
    skillsEditedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  })
    .index("by_resumeId", ["resumeId"])
    .index("by_userId_and_status", ["userId", "status"]),

  // Cache of skill-name lookups in ESCO, keyed by skillKey(name). A row with
  // no `canonical` means ESCO had no close match (so we don't ask again).
  skillCache: defineTable({
    key: v.string(),
    canonical: v.optional(v.string()),
    escoUri: v.optional(v.string()),
    checkedAt: v.number(),
  }).index("by_key", ["key"]),

  // Current job and internship listings (Phase 4). Expired listings are
  // deleted, so every row is active.
  jobs: defineTable({
    ...jobFields,
    /** Hash of normalised title + company, to drop cross-source duplicates. */
    dedupeKey: v.string(),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    /** When the listing's embedding was stored in `jobEmbeddings` (Phase 5). */
    embeddedAt: v.optional(v.number()),
  })
    .index("by_embeddedAt", ["embeddedAt"])
    .index("by_source_and_externalId", ["source", "externalId"])
    .index("by_type_and_postedAt", ["type", "postedAt"])
    .index("by_dedupeKey", ["dedupeKey"])
    .index("by_postedAt", ["postedAt"])
    .index("by_source_and_lastSeenAt", ["source", "lastSeenAt"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["type", "remote"],
    })
    .searchIndex("search_description", {
      searchField: "description",
      filterFields: ["type", "remote"],
    }),

  // One row per job sync run: per-source call counts (free quotas) and totals.
  jobSyncRuns: defineTable({
    startedAt: v.number(),
    finishedAt: v.number(),
    sources: v.array(syncSourceStatValidator),
    inserted: v.number(),
    updated: v.number(),
    duplicates: v.number(),
    expired: v.number(),
    aiCalls: v.number(),
    embedded: v.optional(v.number()),
    embedCalls: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("by_startedAt", ["startedAt"]),

  // ── Matching (Phase 5) ─────────────────────────────────────

  // One Gemini embedding per job (768 dims), kept out of `jobs` so job
  // queries don't ship vectors to the browser. `type`/`remote` are copies of
  // the job's fields, for vector-search filters; deleted with the job.
  jobEmbeddings: defineTable({
    jobId: v.id("jobs"),
    embedding: v.array(v.float64()),
    model: v.string(),
    type: jobKindValidator,
    remote: v.boolean(),
  })
    .index("by_jobId", ["jobId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["type", "remote"],
    }),

  // One row per recommendation refresh. The latest row per user tells the UI
  // whether the cached matches are current (see matches.mine).
  matchRuns: defineTable({
    userId: v.id("users"),
    status: matchRunStatusValidator,
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    /** The analysis (and skill edit) the matches were computed from. */
    analysisId: v.id("analyses"),
    skillsEditedAt: v.optional(v.number()),
    /** False when the explanation AI call failed (rule-based reasons only). */
    explained: v.optional(v.boolean()),
    error: v.optional(v.string()),
  }).index("by_userId_and_startedAt", ["userId", "startedAt"]),

  // The user's current ranked recommendations (replaced on each refresh).
  matches: defineTable({
    userId: v.id("users"),
    runId: v.id("matchRuns"),
    ...matchFields,
  }).index("by_userId_and_rank", ["userId", "rank"]),

  // What the user did with a job. Dismissed jobs are left out of matches.
  jobFeedback: defineTable({
    userId: v.id("users"),
    jobId: v.id("jobs"),
    status: feedbackStatusValidator,
    updatedAt: v.number(),
  })
    .index("by_userId_and_jobId", ["userId", "jobId"])
    .index("by_userId_and_status", ["userId", "status"]),

  // ── Observability (Phase 7) ───────────────────────────────
  // One row per AI request: who served it, how long it took and how many
  // tokens it used. Never the prompt or reply. Pruned after 30 days.
  aiCalls: defineTable({
    at: v.number(),
    provider: v.string(),
    model: v.string(),
    /** What the call was for: "analysis", "ocr", "classify", "explain", … */
    feature: v.string(),
    ms: v.number(),
    ok: v.boolean(),
    /** HTTP-ish status of a failure (429, 503, …), if known. */
    status: v.optional(v.number()),
    attempt: v.number(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
  }).index("by_at", ["at"]),
})
