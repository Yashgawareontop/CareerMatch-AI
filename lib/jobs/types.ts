import type { Infer } from "convex/values"

import type {
  jobKindValidator,
  jobLevelValidator,
  jobSourceValidator,
} from "@/convex/schema"

export type JobSource = Infer<typeof jobSourceValidator>
export type JobKind = Infer<typeof jobKindValidator>
export type JobLevel = Infer<typeof jobLevelValidator>

/** The one shape every source adapter normalises to (mirrors convex/schema.ts). */
export interface Job {
  source: JobSource
  externalId: string
  title: string
  company: string
  location: string
  remote: boolean
  type: JobKind
  level: JobLevel
  description: string
  skills: string[]
  salary?: { min?: number; max?: number; currency?: string; text?: string }
  url: string
  postedAt: number
}

/**
 * What an adapter returns before classification: type/level are hints from
 * the source's own fields, if it has them; `tags` feed skill extraction.
 */
export type RawJob = Omit<Job, "type" | "level" | "skills"> & {
  typeHint?: JobKind
  levelHint?: JobLevel
  tags?: string[]
}

export interface SourceResult {
  jobs: RawJob[]
  /** HTTP requests made (logged against the source's free quota). */
  calls: number
  /** Set when the adapter didn't run (e.g. no API key). */
  skipped?: string
}

export interface SourceAdapter {
  source: JobSource
  fetch(): Promise<SourceResult>
}
