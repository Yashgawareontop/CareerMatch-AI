import { defineApp } from "convex/server"
import { v } from "convex/values"
import auth from "@convex-dev/auth/convex.config"
import authPassword from "@convex-dev/auth/components/password/convex.config"
import authUsername from "@convex-dev/auth/components/username/convex.config"
import rateLimiter from "@convex-dev/rate-limiter/convex.config"

const app = defineApp({
  env: {
    // Shared with the Next.js server (same name in .env.local); lets the
    // resume parse route report results. Generate with `openssl rand -hex 32`.
    RESUME_PARSER_SECRET: v.optional(v.string()),
    // Daily job sync (convex/crons.ts): the public URL of the Next.js app and
    // the secret its /api/jobs/sync route expects (same as in .env.local).
    JOBS_SYNC_URL: v.optional(v.string()),
    JOBS_SYNC_SECRET: v.optional(v.string()),
    // Comma-separated Convex user ids that may see service-wide AI usage on
    // /usage. Find yours in the dashboard's users table.
    ADMIN_USER_IDS: v.optional(v.string()),
  },
})

// Convex Auth: the core must be mounted under its default name, `auth`.
app.use(auth)
app.use(authPassword)
app.use(authUsername)
app.use(rateLimiter)

export default app
