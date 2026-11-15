import { timingSafeEqual } from "node:crypto"

import { serverEnv } from "@/lib/env"
import { embedPendingJobs } from "@/lib/matching"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * POST /api/jobs/embed   header: x-jobs-sync-secret: <JOBS_SYNC_SECRET>
 * Embeds listings that have no embedding yet (backfill). The daily sync
 * does this too; use this after a quota error or the first deploy.
 */
export async function POST(request: Request) {
  const env = serverEnv()
  if (!env.JOBS_SYNC_SECRET || !env.RESUME_PARSER_SECRET) {
    return Response.json(
      { error: "Job sync is not configured" },
      { status: 500 }
    )
  }
  const given = Buffer.from(request.headers.get("x-jobs-sync-secret") ?? "")
  const expected = Buffer.from(env.JOBS_SYNC_SECRET)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const result = await embedPendingJobs(env.RESUME_PARSER_SECRET, 270_000)
  return Response.json(result, { status: result.error ? 502 : 200 })
}
