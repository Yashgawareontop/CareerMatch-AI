import "server-only"

import { aliasFor, skillKey, tidySkillName } from "@/convex/skillNames"

import type { Skill } from "./schema"

/**
 * Skill-name cleanup: the fixed alias map first, then ESCO for names the map
 * doesn't know. ESCO answers are cached (see convex/skillCache.ts) so each
 * name is looked up once across all users.
 */

export interface CachedLookup {
  key: string
  /** Display name to use, or null to keep the resume's own spelling. */
  canonical: string | null
  /** ESCO concept URI; null when ESCO had no close match. */
  escoUri: string | null
}

/** Where ESCO lookups are cached. The analyze route backs it with Convex. */
export interface SkillCache {
  lookup(keys: string[]): Promise<CachedLookup[]>
  remember(entries: CachedLookup[]): Promise<void>
}

const ESCO_SEARCH = "https://ec.europa.eu/esco/api/search"
const ESCO_TIMEOUT_MS = 4000
const ESCO_CONCURRENCY = 5
/** At most this many uncached names go to ESCO per analysis. */
const MAX_ESCO_LOOKUPS = 25

const LEVEL_RANK: Record<Skill["level"], number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
}

type RawSkill = Omit<Skill, "escoUri">

/** Cleans, canonicalises and de-duplicates the AI's skill list. */
export async function cleanSkills(
  raw: RawSkill[],
  cache: SkillCache | null
): Promise<Skill[]> {
  const skills: Skill[] = raw
    .map((s) => ({ ...s, name: tidySkillName(s.name) }))
    .filter((s) => s.name.length > 0)
    .map((s) => ({ ...s, name: aliasFor(s.name) ?? s.name }))

  const unknownKeys = [
    ...new Set(
      skills
        .filter((s) => aliasFor(s.name) === null)
        .map((s) => skillKey(s.name))
    ),
  ]
  const lookups = cache ? await resolveUnknown(unknownKeys, cache) : new Map()

  const resolved = skills.map((s) => {
    const hit = lookups.get(skillKey(s.name))
    if (!hit) return s
    return {
      ...s,
      name: hit.canonical ?? s.name,
      escoUri: hit.escoUri ?? undefined,
    }
  })
  return dedupe(resolved)
}

async function resolveUnknown(keys: string[], cache: SkillCache) {
  const result = new Map<string, CachedLookup>()
  if (keys.length === 0) return result

  try {
    for (const hit of await cache.lookup(keys)) result.set(hit.key, hit)
  } catch (error) {
    console.warn("[analysis] skill cache lookup failed", error)
  }

  const misses = keys.filter((k) => !result.has(k)).slice(0, MAX_ESCO_LOOKUPS)
  const fresh: CachedLookup[] = []
  for (let i = 0; i < misses.length; i += ESCO_CONCURRENCY) {
    const batch = misses.slice(i, i + ESCO_CONCURRENCY)
    const answers = await Promise.all(batch.map(searchEsco))
    for (const answer of answers) {
      // null = network problem: don't cache, try again next time.
      if (answer === null) continue
      fresh.push(answer)
      result.set(answer.key, answer)
    }
  }

  if (fresh.length > 0) {
    await cache.remember(fresh).catch((error) => {
      console.warn("[analysis] skill cache write failed", error)
    })
  }
  return result
}

const EscoResponse = {
  results(json: unknown): EscoResult[] {
    const embedded = (json as { _embedded?: { results?: unknown } })?._embedded
    return Array.isArray(embedded?.results)
      ? (embedded.results as EscoResult[])
      : []
  },
}

interface EscoResult {
  uri?: string
  title?: string
  preferredLabel?: { en?: string }
  alternativeLabel?: { en?: string[] }
}

/** "Python (computer programming)" → "Python". */
function stripQualifier(label: string) {
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim()
}

/**
 * Looks a name up in ESCO and accepts only a close match: the query must
 * equal the concept's label or one of its alternative labels. ESCO's fuzzy
 * search otherwise returns loosely related skills ("teamwork" →
 * "facilitate teamwork between students"). Returns null on network errors.
 */
async function searchEsco(key: string): Promise<CachedLookup | null> {
  const url = new URL(ESCO_SEARCH)
  url.search = new URLSearchParams({
    language: "en",
    type: "skill",
    text: key,
    limit: "3",
    full: "true",
  }).toString()

  let json: unknown
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(ESCO_TIMEOUT_MS),
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!res.ok) return null
    json = await res.json()
  } catch {
    return null
  }

  for (const r of EscoResponse.results(json)) {
    const title = r.title ?? r.preferredLabel?.en
    if (!title || !r.uri) continue
    const labels = [title, ...(r.alternativeLabel?.en ?? [])]
    const matches = labels.some(
      (label) => skillKey(stripQualifier(label)) === key
    )
    if (!matches) continue
    const name = stripQualifier(title)
    return {
      key,
      // ESCO writes most skills in lowercase ("teamwork principles"); keep
      // its spelling only for proper names like "PostgreSQL".
      canonical: /[A-Z]/.test(name) ? name : null,
      escoUri: r.uri,
    }
  }
  return { key, canonical: null, escoUri: null }
}

/** Merges duplicates (same key), keeping the higher level and longer evidence. */
function dedupe(skills: Skill[]): Skill[] {
  const byKey = new Map<string, Skill>()
  for (const s of skills) {
    const key = skillKey(s.name)
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, s)
      continue
    }
    byKey.set(key, {
      ...prev,
      level:
        LEVEL_RANK[s.level] > LEVEL_RANK[prev.level] ? s.level : prev.level,
      evidence:
        s.evidence.length > prev.evidence.length ? s.evidence : prev.evidence,
      escoUri: prev.escoUri ?? s.escoUri,
    })
  }
  return [...byKey.values()]
}
