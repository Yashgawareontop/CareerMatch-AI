import "server-only"

import { z } from "zod"

import { serverEnv } from "@/lib/env"

import { CallCounter, sleep } from "../http"
import {
  clean,
  htmlToText,
  looksRemote,
  positiveNumber,
  toTimestamp,
} from "../text"
import type { JobKind, RawJob, SourceAdapter } from "../types"

// https://developer.adzuna.com/ — free key, ~1,000 calls/month (reported).
// At most 4 calls per daily sync ≈ 120/month. Descriptions are ~500-char snippets.
const QUERIES: { what_or?: string; pages: number }[] = [
  { what_or: "intern internship trainee graduate fresher", pages: 2 },
  { pages: 2 },
]
const PER_PAGE = 50

const item = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  description: z.string().nullish(),
  company: z.object({ display_name: z.string().nullish() }).nullish(),
  location: z.object({ display_name: z.string().nullish() }).nullish(),
  redirect_url: z.string(),
  created: z.string().nullish(),
  salary_min: z.number().nullish(),
  salary_max: z.number().nullish(),
  contract_time: z.string().nullish(),
  contract_type: z.string().nullish(),
})

const CURRENCY: Record<string, string> = {
  in: "INR",
  gb: "GBP",
  us: "USD",
  de: "EUR",
}

export const adzuna: SourceAdapter = {
  source: "adzuna",
  async fetch() {
    const env = serverEnv()
    if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
      return {
        jobs: [],
        calls: 0,
        skipped: "ADZUNA_APP_ID / ADZUNA_APP_KEY not set",
      }
    }
    const country = env.ADZUNA_COUNTRY.toLowerCase()
    const http = new CallCounter()
    const jobs: RawJob[] = []
    for (const query of QUERIES) {
      for (let page = 1; page <= query.pages; page++) {
        if (http.calls > 0) await sleep(500)
        const url = new URL(
          `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`
        )
        url.searchParams.set("app_id", env.ADZUNA_APP_ID)
        url.searchParams.set("app_key", env.ADZUNA_APP_KEY)
        url.searchParams.set("results_per_page", String(PER_PAGE))
        url.searchParams.set("category", "it-jobs")
        url.searchParams.set("max_days_old", "30")
        url.searchParams.set("sort_by", "date")
        if (query.what_or) url.searchParams.set("what_or", query.what_or)
        const data = (await http.json(url)) as { results?: unknown[] }
        const results = data.results ?? []
        for (const raw of results) {
          const r = item.safeParse(raw)
          if (!r.success) continue
          const j = r.data
          const postedAt = toTimestamp(j.created)
          if (!postedAt) continue
          const title = clean(j.title)
          const description = htmlToText(j.description)
          const location = clean(j.location?.display_name)
          const min = positiveNumber(j.salary_min)
          const max = positiveNumber(j.salary_max)
          let typeHint: JobKind | undefined
          if (j.contract_type === "contract") typeHint = "contract"
          else if (j.contract_time === "part_time") typeHint = "part-time"
          else if (j.contract_time === "full_time") typeHint = "full-time"
          jobs.push({
            source: "adzuna",
            externalId: String(j.id),
            title,
            company: clean(j.company?.display_name),
            location,
            remote: looksRemote(title, location, description),
            description,
            salary:
              min || max
                ? { min, max, currency: CURRENCY[country] }
                : undefined,
            url: j.redirect_url,
            postedAt,
            typeHint,
          })
        }
        if (results.length < PER_PAGE) break
      }
    }
    return { jobs, calls: http.calls }
  },
}
