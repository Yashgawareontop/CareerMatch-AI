/// <reference types="vite/client" />
// Shared convex-test setup: the app schema and functions, plus the
// components the functions under test call (auth, username, rate limiter).

import rateLimiterTest from "@convex-dev/rate-limiter/test"
import { convexTest } from "convex-test"
import { mutationGeneric, type FunctionReference } from "convex/server"
import { v } from "convex/values"

import authSchema from "../node_modules/@convex-dev/auth/dist/component/schema.js"
import usernameSchema from "../node_modules/@convex-dev/auth/dist/components/username/schema.js"
import { components } from "../convex/_generated/api"
import type { Id } from "../convex/_generated/dataModel"
import schema from "../convex/schema"

export const SECRET = "test-secret-0123456789abcdef0123456789abcdef"

const appModules = import.meta.glob([
  "../convex/**/*.ts",
  "!../convex/**/*.test.ts",
])

const AUTH_DIR = "../node_modules/@convex-dev/auth/dist/component"
const authModules = {
  ...import.meta.glob(
    "../node_modules/@convex-dev/auth/dist/component/**/*.js"
  ),
  // Test-only: a session row without minting JWTs (which need deployment
  // keys). getAuthUserId still resolves it through the real getSession.
  [`${AUTH_DIR}/testing.js`]: async () => ({
    createSession: mutationGeneric({
      args: { userId: v.string() },
      returns: v.string(),
      handler: async (ctx, { userId }) =>
        await ctx.db.insert("sessions", { userId, component: "test" }),
    }),
  }),
}
const usernameModules = import.meta.glob(
  "../node_modules/@convex-dev/auth/dist/components/username/**/*.js"
)

const createSessionRef = (
  components.auth as unknown as {
    testing: { createSession: FunctionReference<"mutation", "internal"> }
  }
).testing.createSession

export function setup() {
  process.env.RESUME_PARSER_SECRET = SECRET
  const t = convexTest(schema, appModules)
  t.registerComponent("auth", authSchema, authModules)
  t.registerComponent("authUsername", usernameSchema, usernameModules)
  rateLimiterTest.register(t, "rateLimiter")
  return t
}

export type T = ReturnType<typeof setup>

/** A signed-in test user: their id and a client acting as them. */
export async function signedInUser(t: T) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert("users", { signInMethod: "test" })
  )
  const sessionId: string = await t.run(
    async (ctx) =>
      await ctx.runMutation(createSessionRef, { userId: userId as string })
  )
  return {
    userId: userId as Id<"users">,
    as: t.withIdentity({ subject: sessionId }),
  }
}

/** A stored resume for `userId`, with a real (tiny) file in storage. */
export async function storedResume(
  t: T,
  userId: Id<"users">,
  fields: { status?: "uploaded" | "parsed"; rawText?: string } = {}
) {
  const storageId = await t.run(
    async (ctx) => await ctx.storage.store(new Blob(["%PDF-1.4"]))
  )
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("resumes", {
        userId,
        storageId,
        fileName: "resume.pdf",
        status: fields.status ?? "uploaded",
        rawText: fields.rawText,
      })
  )
}
