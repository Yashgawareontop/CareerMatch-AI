import "server-only"

import { z } from "zod"

import { CallCounter } from "../http"
import { clean, htmlToText, positiveNumber, toTimestamp } from "../text"
import type { RawJob, SourceAdapter } from "../types"

// https://remoteok.com/api — public; one call returns the whole recent feed.
// Attribution (a link back to Remote OK) is required.

const item = z.object({
  id: z.union([z.number(), z.string()]),
  epoch: z.union([z.number(), z.string()]).nullish(),
  date: z.string().nullish(),
  company: z.string().nullish(),
  position: z.string(),
  tags: z.array(z.string()).nullish(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  salary_min: z.union([z.number(), z.string()]).nullish(),
  salary_max: z.union([z.number(), z.string()]).nullish(),
  url: z.string(),
})

export const remoteok: SourceAdapter = {
  source: "remoteok",
  async fetch() {
    const http = new CallCounter()
    const data = await http.json("https://remoteok.com/api")
    const jobs: RawJob[] = []
    // The first element is a legal notice, not a job (it fails the schema).
    for (const raw of Array.isArray(data) ? data : []) {
      const r = item.safeParse(raw)
      if (!r.success) continue
      const j = r.data
      const postedAt = toTimestamp(j.epoch) ?? toTimestamp(j.date)
      if (!postedAt) continue
      const min = positiveNumber(j.salary_min)
      const max = positiveNumber(j.salary_max)
      jobs.push({
        source: "remoteok",
        externalId: String(j.id),
        title: clean(j.position),
        company: clean(j.company),
        location: clean(j.location) || "Remote",
        remote: true,
        description: htmlToText(j.description),
        salary: min || max ? { min, max, currency: "USD" } : undefined,
        url: j.url,
        postedAt,
        tags: j.tags ?? [],
      })
    }
    return { jobs, calls: http.calls }
  },
}
