import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError } from "convex/values"

import { env, type QueryCtx } from "./_generated/server"

/** The signed-in user's id, or a "Not signed in" error. */
export async function requireUserId(ctx: QueryCtx) {
  const userId = await getAuthUserId<"users">(ctx)
  if (userId === null) throw new ConvexError("Not signed in")
  return userId
}

/**
 * For functions only the Next.js server may call (writing parse/analysis
 * results, the skill cache). It sends RESUME_PARSER_SECRET, which is set on
 * both the Next.js server and the Convex deployment. Constant-time compare.
 */
export function requireServerSecret(secret: string) {
  const expected = env.RESUME_PARSER_SECRET
  if (!expected)
    throw new ConvexError(
      "RESUME_PARSER_SECRET is not set on the Convex deployment"
    )
  if (secret.length !== expected.length) throw new ConvexError("Forbidden")
  let diff = 0
  for (let i = 0; i < secret.length; i++)
    diff |= secret.charCodeAt(i) ^ expected.charCodeAt(i)
  if (diff !== 0) throw new ConvexError("Forbidden")
}
