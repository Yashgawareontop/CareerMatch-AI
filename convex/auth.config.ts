import { convexAuthProvider } from "@convex-dev/auth/server"
import type { AuthConfig } from "convex/server"

// Without this file ctx.auth.getUserIdentity() is always null.
export default {
  providers: [convexAuthProvider()],
} satisfies AuthConfig
