import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

// Daily job-listing refresh (03:30 UTC). The sync route also refuses runs
// less than 20 hours apart, which keeps every source within its free quota.
crons.cron("sync job listings", "30 3 * * *", internal.jobsCron.triggerSync, {})

// Drop AI call telemetry older than 30 days (04:10 UTC).
crons.cron("prune ai call log", "10 4 * * *", internal.aiCalls.prune, {})

export default crons
