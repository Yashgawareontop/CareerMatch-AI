import "server-only"

import { z } from "zod"

import { CallCounter, sleep } from "../http"
import { clean, htmlToText, positiveNumber, toTimestamp } from "../text"
import type { JobKind, JobLevel, RawJob, SourceAdapter } from "../types"

// https://himalayas.app/api — public remote-jobs JSON, at most 20 per page.
const PAGE_SIZE = 20
const PAGES = 10

const item = z.object({
  guid: z.string().nullish(),
  title: z.string(),
  excerpt: z.string().nullish(),
  companyName: z.string().nullish(),
  employmentType: z.string().nullish(),
  minSalary: z.union([z.number(), z.string()]).nullish(),
  maxSalary: z.union([z.number(), z.string()]).nullish(),
  currency: z.string().nullish(),
  seniority: z.array(z.string()).nullish(),
  locationRestrictions: z.array(z.string()).nullish(),
  categories: z.array(z.string()).nullish(),
  description: z.string().nullish(),
  pubDate: z.union([z.number(), z.string()]).nullish(),
  applicationLink: z.string().nullish(),
})

function typeHint(employment: string): JobKind | undefined {
  const t = employment.toLowerCase()
  if (t.includes("intern")) return "internship"
  if (t.includes("part")) return "part-time"
  if (t.includes("contract") || t.includes("freelance")) return "contract"
  if (t.includes("full")) return "full-time"
  return undefined
}

function levelHint(seniority: string[]): JobLevel | undefined {
  const s = seniority.join(" ").toLowerCase()
  if (!s) return undefined
  if (s.includes("intern")) return "intern"
  if (/entry|junior/.test(s)) return "entry"
  if (/senior|lead|manager|director|executive/.test(s)) return "senior"
  if (/mid/.test(s)) return "mid"
  return undefined
}

export const himalayas: SourceAdapter = {
  source: "himalayas",
  async fetch() {
    const http = new CallCounter()
    const jobs: RawJob[] = []
    for (let page = 0; page < PAGES; page++) {
      if (page > 0) await sleep(400)
      const data = (await http.json(
        `https://himalayas.app/jobs/api?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`
      )) as { jobs?: unknown[] }
      const items = data.jobs ?? []
      for (const raw of items) {
        const r = item.safeParse(raw)
        if (!r.success) continue
        const j = r.data
        const postedAt = toTimestamp(j.pubDate)
        const url = j.applicationLink ?? j.guid
        if (!postedAt || !url) continue
        const min = positiveNumber(j.minSalary)
        const max = positiveNumber(j.maxSalary)
        jobs.push({
          source: "himalayas",
          externalId: j.guid ?? url,
          title: clean(j.title),
          company: clean(j.companyName),
          location: j.locationRestrictions?.length
            ? `Remote (${j.locationRestrictions.slice(0, 3).join(", ")})`
            : "Remote",
          remote: true,
          description: htmlToText(j.description ?? j.excerpt),
          salary:
            min || max
              ? { min, max, currency: j.currency ?? undefined }
              : undefined,
          url,
          postedAt,
          typeHint: j.employmentType ? typeHint(j.employmentType) : undefined,
          levelHint: levelHint(j.seniority ?? []),
          tags: j.categories ?? [],
        })
      }
      if (items.length < PAGE_SIZE) break
    }
    return { jobs, calls: http.calls }
  },
}
