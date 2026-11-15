import "server-only"

import { z } from "zod"

import { serverEnv } from "@/lib/env"

import { CallCounter, sleep } from "../http"
import { clean, htmlToText, looksRemote, toTimestamp } from "../text"
import type { JobKind, RawJob, SourceAdapter } from "../types"

// https://jooble.org/api/about — free key on request. 2 calls per sync.
// Links point to Jooble's own pages.
const KEYWORDS = ["internship software", "software developer"]

const item = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  location: z.string().nullish(),
  snippet: z.string().nullish(),
  salary: z.string().nullish(),
  type: z.string().nullish(),
  link: z.string(),
  company: z.string().nullish(),
  updated: z.string().nullish(),
})

function typeHint(type: string): JobKind | undefined {
  const t = type.toLowerCase()
  if (t.includes("intern")) return "internship"
  if (t.includes("part")) return "part-time"
  if (t.includes("contract") || t.includes("temporary")) return "contract"
  if (t.includes("full")) return "full-time"
  return undefined
}

export const jooble: SourceAdapter = {
  source: "jooble",
  async fetch() {
    const env = serverEnv()
    if (!env.JOOBLE_API_KEY) {
      return { jobs: [], calls: 0, skipped: "JOOBLE_API_KEY not set" }
    }
    const http = new CallCounter()
    const jobs: RawJob[] = []
    for (const keywords of KEYWORDS) {
      if (http.calls > 0) await sleep(500)
      const data = (await http.json(
        `https://jooble.org/api/${env.JOOBLE_API_KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            keywords,
            location: env.JOOBLE_LOCATION,
            page: "1",
          }),
        }
      )) as { jobs?: unknown[] }
      for (const raw of data.jobs ?? []) {
        const r = item.safeParse(raw)
        if (!r.success) continue
        const j = r.data
        const postedAt = toTimestamp(j.updated)
        if (!postedAt) continue
        const title = clean(j.title)
        const location = clean(j.location)
        jobs.push({
          source: "jooble",
          externalId: String(j.id),
          title,
          company: clean(j.company),
          location,
          remote: looksRemote(title, location),
          description: htmlToText(j.snippet),
          salary: j.salary ? { text: clean(j.salary, 100) } : undefined,
          url: j.link,
          postedAt,
          typeHint: j.type ? typeHint(j.type) : undefined,
        })
      }
    }
    return { jobs, calls: http.calls }
  },
}
