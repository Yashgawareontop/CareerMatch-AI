import { timingSafeEqual } from "node:crypto"

import { fetchQuery } from "convex/nextjs"

import { api } from "@/convex/_generated/api"
import { serverEnv } from "@/lib/env"
import { syncJobs } from "@/lib/jobs/sync"

export const runtime = "nodejs"
export const maxDuration = 300

/** Runs closer together than this are refused (protects free API quotas). */
const COOLDOWN_MS = 20 * 60 * 60 * 1000

/**
 * POST /api/jobs/sync          header: x-jobs-sync-secret: <JOBS_SYNC_SECRET>
 * POST /api/jobs/sync?force=1  skips the 20-hour cooldown
 *
 * Called daily by the Convex cron (convex/crons.ts → jobsCron.triggerSync).
 * Fetches every job source, writes listings to Convex, logs call counts.
 */
export async function POST(request: Request) {
  const env = serverEnv()
  if (!env.JOBS_SYNC_SECRET || !env.RESUME_PARSER_SECRET) {
    console.error(
      "[jobs/sync] JOBS_SYNC_SECRET or RESUME_PARSER_SECRET is not set"
    )
    return Response.json(
      { error: "Job sync is not configured" },
      { status: 500 }
    )
  }
  if (
    !secretMatches(
      request.headers.get("x-jobs-sync-secret"),
      env.JOBS_SYNC_SECRET
    )
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const secret = env.RESUME_PARSER_SECRET

  const force = new URL(request.url).searchParams.get("force") === "1"
  if (!force) {
    const [last] = await fetchQuery(api.jobs.recentRuns, { secret, limit: 1 })
    if (last && Date.now() - last.startedAt < COOLDOWN_MS) {
      return Response.json(
        {
          status: "skipped",
          reason:
            "Last sync was less than 20 hours ago (use ?force=1 to override)",
          lastRunAt: new Date(last.startedAt).toISOString(),
        },
        { status: 429 }
      )
    }
  }

  try {
    const summary = await syncJobs(secret)
    return Response.json({ status: "done", ...summary })
  } catch (error) {
    console.error("[jobs/sync] failed", error)
    return Response.json(
      {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

function secretMatches(given: string | null, expected: string) {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
