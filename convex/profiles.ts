import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError, v } from "convex/values"

import { mutation, query, type QueryCtx } from "./_generated/server"
import schema, { profileFields } from "./schema"

const MAX_TEXT = 200
const MAX_LIST = 20

async function requireUserId(ctx: QueryCtx) {
  const userId = await getAuthUserId<"users">(ctx)
  if (userId === null) throw new ConvexError("Not signed in")
  return userId
}

/** The signed-in user's own profile, or null. Never reads anyone else's. */
export const getMine = query({
  args: {},
  returns: v.union(v.null(), schema.doc("profiles")),
  handler: async (ctx) => {
    const userId = await getAuthUserId<"users">(ctx)
    if (userId === null) return null
    return await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique()
  },
})

/** Create or update the signed-in user's profile. */
export const upsertMine = mutation({
  args: profileFields,
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)

    const clean = {
      name: cleanText(args.name, "Name"),
      education: cleanText(args.education, "Education"),
      location: cleanText(args.location, "Location"),
      graduationYear: args.graduationYear,
      preferredRoles: cleanList(args.preferredRoles, "Preferred roles"),
      jobTypes: [...new Set(args.jobTypes)],
      targetIndustries: cleanList(args.targetIndustries, "Target industries"),
    }
    if (
      !Number.isInteger(clean.graduationYear) ||
      clean.graduationYear < 1950 ||
      clean.graduationYear > 2100
    ) {
      throw new ConvexError("Graduation year is invalid")
    }
    if (clean.jobTypes.length === 0) {
      throw new ConvexError("Pick at least one job type")
    }

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique()
    const doc = { userId, ...clean, updatedAt: Date.now() }
    if (existing) {
      await ctx.db.replace("profiles", existing._id, doc)
      return existing._id
    }
    return await ctx.db.insert("profiles", doc)
  },
})

function cleanText(value: string, label: string) {
  const trimmed = value.trim()
  if (trimmed.length === 0) throw new ConvexError(`${label} is required`)
  if (trimmed.length > MAX_TEXT) throw new ConvexError(`${label} is too long`)
  return trimmed
}

function cleanList(values: string[], label: string) {
  const items = [...new Set(values.map((s) => s.trim()).filter(Boolean))]
  if (items.length > MAX_LIST) {
    throw new ConvexError(`${label}: at most ${MAX_LIST} entries`)
  }
  if (items.some((s) => s.length > MAX_TEXT)) {
    throw new ConvexError(`${label}: an entry is too long`)
  }
  return items
}
