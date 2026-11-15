import "server-only"

import { z } from "zod"

import { CallCounter, sleep } from "../http"
import { clean, htmlToText, toTimestamp } from "../text"
import type { JobKind, JobLevel, RawJob, SourceAdapter } from "../types"

// https://www.arbeitnow.com/blog/job-board-api — public, ~100 jobs per page.
const PAGES = 5

const item = z.object({
  slug: z.string(),
  company_name: z.string().nullish(),
  title: z.string(),
  description: z.string().nullish(),
  remote: z.boolean().nullish(),
  url: z.string(),
  tags: z.array(z.string()).nullish(),
  job_types: z.array(z.string()).nullish(),
  location: z.string().nullish(),
  created_at: z.union([z.number(), z.string()]).nullish(),
})

function hints(types: string[]): { type?: JobKind; level?: JobLevel } {
  const t = types.join(" ").toLowerCase()
  if (/intern|praktikum|werkstudent|working student/.test(t))
    return { type: "internship", level: "intern" }
  if (/part.?time|teilzeit/.test(t)) return { type: "part-time" }
  if (/contract|freelance/.test(t)) return { type: "contract" }
  if (/full.?time|vollzeit/.test(t)) return { type: "full-time" }
  return {}
}

export const arbeitnow: SourceAdapter = {
  source: "arbeitnow",
  async fetch() {
    const http = new CallCounter()
    const jobs: RawJob[] = []
    for (let page = 1; page <= PAGES; page++) {
      if (page > 1) await sleep(500)
      const data = (await http.json(
        `https://www.arbeitnow.com/api/job-board-api?page=${page}`
      )) as { data?: unknown[]; links?: { next?: string | null } }
      for (const raw of data.data ?? []) {
        const r = item.safeParse(raw)
        if (!r.success) continue
        const j = r.data
        const postedAt = toTimestamp(j.created_at)
        if (!postedAt) continue
        const h = hints(j.job_types ?? [])
        jobs.push({
          source: "arbeitnow",
          externalId: j.slug,
          title: clean(j.title),
          company: clean(j.company_name),
          location: clean(j.location) || (j.remote ? "Remote" : ""),
          remote: j.remote ?? false,
          description: htmlToText(j.description),
          url: j.url,
          postedAt,
          typeHint: h.type,
          levelHint: h.level,
          tags: j.tags ?? [],
        })
      }
      if (!data.links?.next) break
    }
    return { jobs, calls: http.calls }
  },
}
