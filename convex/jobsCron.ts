import { v } from "convex/values"

import { env, internalAction } from "./_generated/server"

/**
 * Asks the Next.js server to sync job listings. Convex stays the database:
 * external API and AI calls happen in app/api/jobs/sync, which writes back.
 * Needs JOBS_SYNC_URL (public app URL, e.g. https://app.example.com) and
 * JOBS_SYNC_SECRET on the Convex deployment; does nothing without them.
 */
export const triggerSync = internalAction({
  args: {},
  returns: v.null(),
  handler: async () => {
    const baseUrl = env.JOBS_SYNC_URL
    const secret = env.JOBS_SYNC_SECRET
    if (!baseUrl || !secret) {
      console.log(
        "[jobs] JOBS_SYNC_URL / JOBS_SYNC_SECRET not set; skipping sync"
      )
      return null
    }
    const response = await fetch(new URL("/api/jobs/sync", baseUrl), {
      method: "POST",
      headers: { "x-jobs-sync-secret": secret },
    })
    const body = await response.text()
    console.log(
      `[jobs] sync responded ${response.status}: ${body.slice(0, 500)}`
    )
    return null
  },
})
