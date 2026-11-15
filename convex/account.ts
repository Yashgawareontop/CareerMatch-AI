import { v } from "convex/values"

import { components } from "./_generated/api"
import { mutation } from "./_generated/server"
import { requireUserId } from "./serverAuth"

/**
 * Deletes the signed-in user's account and all their data: resumes (and
 * stored files), analyses, profile, matches, feedback, sessions and
 * username. The password component has no delete API, so its hash row is
 * left behind, unreachable without the username.
 */
export const deleteMine = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)

    for await (const row of ctx.db
      .query("matches")
      .withIndex("by_userId_and_rank", (q) => q.eq("userId", userId)))
      await ctx.db.delete("matches", row._id)
    for await (const row of ctx.db
      .query("matchRuns")
      .withIndex("by_userId_and_startedAt", (q) => q.eq("userId", userId)))
      await ctx.db.delete("matchRuns", row._id)
    for await (const row of ctx.db
      .query("jobFeedback")
      .withIndex("by_userId_and_status", (q) => q.eq("userId", userId)))
      await ctx.db.delete("jobFeedback", row._id)
    for await (const row of ctx.db
      .query("analyses")
      .withIndex("by_userId_and_status", (q) => q.eq("userId", userId)))
      await ctx.db.delete("analyses", row._id)
    for await (const row of ctx.db
      .query("resumes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))) {
      await ctx.storage.delete(row.storageId)
      await ctx.db.delete("resumes", row._id)
    }
    for await (const row of ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId)))
      await ctx.db.delete("profiles", row._id)

    // Auth data: end every session, then free the username.
    const sessions = await ctx.runQuery(components.auth.public.listSessions, {
      userId,
    })
    if (sessions.length > 0) {
      await ctx.runMutation(components.auth.public.revokeSessions, {
        sessionIds: sessions.map((s) => s.sessionId),
      })
    }
    await ctx.runMutation(components.authUsername.public.deleteUsername, {
      userId,
    })

    await ctx.db.delete("users", userId)
    return null
  },
})
