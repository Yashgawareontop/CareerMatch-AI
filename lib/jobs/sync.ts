import "server-only"

import { createHash } from "node:crypto"

import { fetchMutation, fetchQuery } from "convex/nextjs"

import { api } from "@/convex/_generated/api"

import { embedPendingJobs } from "@/lib/matching/embed-jobs"

import { aiLevels, ruleLevel, ruleType } from "./classify"
import { extractSkills } from "./skills"
import { SOURCES } from "./sources"
import type { Job, JobLevel, JobSource, RawJob } from "./types"

const DAY = 24 * 60 * 60 * 1000
const MAX_AGE_MS = 30 * DAY
const UPSERT_BATCH = 50
const KNOWN_BATCH = 200

// Listings must look like tech roles: a tech word in the title, or at least
// two technical skills in the text (Arbeitnow/Himalayas carry many non-tech).
const TECH_TITLE =
  /\b(develop(er|ment)|engineer(ing)?|software|programm(er|ing)|data|devops|sre|cloud|security|cyber|qa|test(er|ing)?|frontend|front[- ]end|backend|back[- ]end|full[- ]?stack|web|mobile|android|ios|machine learning|ml|ai|analyst|it|platform|infrastructure|database|ux|ui|product designer|scientist|technical|tech)\b/i

// Titles that trip TECH_TITLE but usually aren't software roles ("Sales
// Development Representative", "Mechanical Engineer"). They stay only when
// the text names at least two technical skills.
const NON_TECH_TITLE =
  /\b(sales|business develop(er|ment)|learning (&|and) development|mechanical|civil|electrical|chemical|construction|nurs(e|ing)|marketing|recruit(er|ing)|account (manager|executive)|customer success)\b/i

export interface SyncSummary {
  startedAt: number
  finishedAt: number
  sources: {
    source: JobSource
    calls: number
    fetched: number
    kept: number
    skipped?: string
    error?: string
  }[]
  inserted: number
  updated: number
  duplicates: number
  expired: number
  aiCalls: number
  /** Listings embedded for matching, and the Gemini requests that took. */
  embedded: number
  embedCalls: number
}

/** Hash of normalised title + company, shared by reposts across sources. */
export function dedupeKey(
  job: Pick<RawJob, "title" | "company" | "source" | "externalId">
) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ") // "(m/w/d)", "(Remote)"
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  const company = norm(job.company)
  const basis = company
    ? `${norm(job.title)}|${company}`
    : `${job.source}:${job.externalId}`
  return createHash("sha256").update(basis).digest("hex").slice(0, 32)
}

/**
 * Fetches every source, normalises and de-duplicates the listings, labels
 * level/type/skills, writes them to Convex and deletes expired rows.
 * `secret` is the Convex server secret (RESUME_PARSER_SECRET).
 */
export async function syncJobs(secret: string): Promise<SyncSummary> {
  const startedAt = Date.now()
  const results = await Promise.all(
    SOURCES.map(async (adapter) => {
      try {
        return { source: adapter.source, ...(await adapter.fetch()) }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[jobs] ${adapter.source} failed: ${message}`)
        // A failed request still counted against the quota; at least 1.
        return { source: adapter.source, jobs: [], calls: 1, error: message }
      }
    })
  )

  // Normalise, filter, and drop duplicates within this run.
  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()
  const candidates: (Omit<Job, "level"> & {
    level: JobLevel | null
    dedupeKey: string
  })[] = []
  const stats: SyncSummary["sources"] = []

  for (const result of results) {
    let kept = 0
    for (const raw of result.jobs) {
      if (!raw.title || !raw.url.startsWith("http")) continue
      if (raw.postedAt < startedAt - MAX_AGE_MS) continue
      const id = `${raw.source}:${raw.externalId}`
      const key = dedupeKey(raw)
      if (seenIds.has(id) || seenKeys.has(key)) continue

      const skills = extractSkills(raw.title, raw.description, raw.tags)
      const techTitle =
        TECH_TITLE.test(raw.title) && !NON_TECH_TITLE.test(raw.title)
      if (!techTitle && skills.length < 2) continue

      seenIds.add(id)
      seenKeys.add(key)
      const level = ruleLevel(raw.title, raw.levelHint)
      candidates.push({
        source: raw.source,
        externalId: raw.externalId.slice(0, 200),
        title: raw.title,
        company: raw.company || "Unknown company",
        location: raw.location || (raw.remote ? "Remote" : "Not specified"),
        remote: raw.remote,
        type: ruleType(raw, level ?? "unknown"),
        level,
        description: raw.description,
        skills,
        salary: raw.salary,
        url: raw.url.slice(0, 2000),
        postedAt: Math.min(raw.postedAt, startedAt),
        dedupeKey: key,
      })
      kept++
    }
    stats.push({
      source: result.source,
      calls: result.calls,
      fetched: result.jobs.length,
      kept,
      ...("skipped" in result && result.skipped
        ? { skipped: result.skipped }
        : {}),
      ...("error" in result && result.error ? { error: result.error } : {}),
    })
  }

  // Only listings the AI hasn't labelled yet go to it: new ones, and stored
  // ones still "unknown" (e.g. over an earlier run's cap). Others keep their
  // stored level (upsertBatch ignores "unknown" for existing rows).
  const labelled = new Set<string>()
  for (let i = 0; i < candidates.length; i += KNOWN_BATCH) {
    const items = candidates
      .slice(i, i + KNOWN_BATCH)
      .map((c) => ({ source: c.source, externalId: c.externalId }))
    for (const row of await fetchQuery(api.jobs.knownIds, { secret, items }))
      if (row.level !== "unknown") labelled.add(row.id)
  }
  const unclear = candidates
    .filter(
      (c) => c.level === null && !labelled.has(`${c.source}:${c.externalId}`)
    )
    .sort((a, b) => b.postedAt - a.postedAt)
  const { levels, calls: aiCalls } = await aiLevels(unclear)
  unclear.forEach((c, i) => {
    const level = levels.get(i)
    if (level) {
      c.level = level
      if (level === "intern") c.type = "internship"
    }
  })

  // Write in batches.
  let inserted = 0
  let updated = 0
  let duplicates = 0
  for (let i = 0; i < candidates.length; i += UPSERT_BATCH) {
    const jobs = candidates
      .slice(i, i + UPSERT_BATCH)
      .map((c) => ({ ...c, level: c.level ?? ("unknown" as const) }))
    const r = await fetchMutation(api.jobs.upsertBatch, { secret, jobs })
    inserted += r.inserted
    updated += r.updated
    duplicates += r.duplicates
  }

  // Expire: too old, or no longer returned by a source that synced fine.
  const syncedSources = stats
    .filter((s) => !s.error && !s.skipped && s.fetched > 0)
    .map((s) => s.source)
  let expired = 0
  for (let round = 0; round < 50; round++) {
    const r = await fetchMutation(api.jobs.expireBatch, {
      secret,
      syncedSources,
    })
    expired += r.deleted
    if (!r.more) break
  }

  // Embed new listings for matching (Phase 5). Leftovers wait for next run.
  const embedding = await embedPendingJobs(secret)

  const summary: SyncSummary = {
    startedAt,
    finishedAt: Date.now(),
    sources: stats,
    inserted,
    updated,
    duplicates,
    expired,
    aiCalls,
    embedded: embedding.embedded,
    embedCalls: embedding.calls,
  }
  await fetchMutation(api.jobs.recordRun, { secret, run: summary })
  console.log(
    `[jobs] sync: +${inserted} new, ${updated} refreshed, ${duplicates} dupes, ${expired} expired, AI calls ${aiCalls}, embedded ${embedding.embedded} (${embedding.calls} calls); ` +
      stats.map((s) => `${s.source}=${s.calls} calls/${s.kept} kept`).join(", ")
  )
  return summary
}
