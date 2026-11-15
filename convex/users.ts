import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

import { internalMutation, query } from "./_generated/server"

/** Called by Convex Auth once per new account (see convex/auth.ts). */
export const createUser = internalMutation({
  args: {
    method: v.object({
      name: v.literal("usernamePassword"),
      profile: v.object({}),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", { signInMethod: args.method.name })
  },
})

/** The signed-in user, or null. */
export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ _id: v.id("users"), hasProfile: v.boolean() })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId<"users">(ctx)
    if (userId === null) return null
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique()
    return { _id: userId, hasProfile: profile !== null }
  },
})
