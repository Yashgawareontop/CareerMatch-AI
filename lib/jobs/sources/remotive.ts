import "server-only"

import { z } from "zod"

import { CallCounter } from "../http"
import { clean, htmlToText, toTimestamp } from "../text"
import type { JobKind, RawJob, SourceAdapter } from "../types"

// https://remotive.com/api-documentation — no key. Their feed is delayed and
// they ask for only a few calls a day, and for a link back to Remotive.
const CATEGORIES = ["software-dev", "data", "devops"]

const item = z.object({
  id: z.union([z.number(), z.string()]),
  url: z.string(),
  title: z.string(),
  company_name: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  job_type: z.string().nullish(),
  publication_date: z.string().nullish(),
  candidate_required_location: z.string().nullish(),
  salary: z.string().nullish(),
  description: z.string().nullish(),
})

const TYPES: Record<string, JobKind> = {
  full_time: "full-time",
  part_time: "part-time",
  contract: "contract",
  freelance: "contract",
  internship: "internship",
}

export const remotive: SourceAdapter = {
  source: "remotive",
  async fetch() {
    const http = new CallCounter()
    const jobs: RawJob[] = []
    for (const category of CATEGORIES) {
      const data = (await http.json(
        `https://remotive.com/api/remote-jobs?category=${category}`
      )) as { jobs?: unknown[] }
      for (const raw of data.jobs ?? []) {
        const r = item.safeParse(raw)
        if (!r.success) continue
        const j = r.data
        const postedAt = toTimestamp(j.publication_date)
        if (!postedAt) continue
        jobs.push({
          source: "remotive",
          externalId: String(j.id),
          title: clean(j.title),
          company: clean(j.company_name),
          location: clean(j.candidate_required_location) || "Remote",
          remote: true,
          description: htmlToText(j.description),
          salary: j.salary ? { text: clean(j.salary, 100) } : undefined,
          url: j.url,
          postedAt,
          typeHint: j.job_type ? TYPES[j.job_type] : undefined,
          tags: j.tags ?? [],
        })
      }
    }
    return { jobs, calls: http.calls }
  },
}
