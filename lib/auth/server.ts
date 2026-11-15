import { setupConvexAuthServer } from "@convex-dev/auth/ssr"
import { setupConvexAuthNextjs } from "@convex-dev/auth/ssr/nextjs"

import { api } from "@/convex/_generated/api"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
if (!convexUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to create .env.local."
  )
}

const secure = process.env.NODE_ENV === "production"

/**
 * Route handlers for /auth/signin, /auth/refresh and /auth/signout.
 * The refresh token lives only in an httpOnly cookie set by these handlers.
 */
export const authRoutes = setupConvexAuthServer({
  convexUrl,
  refreshSession: api.auth.refreshSession,
  signOut: api.auth.signOut,
  // Allowlist of every Convex function that can mint a session.
  signIn: [
    api.auth.signInWithUsernamePassword,
    api.auth.signUpWithUsernamePassword,
  ],
  cookieOptions: { secure },
})

export const {
  convexAuthNextjsProxy,
  nextjsProxyRedirect,
  convexAuthNextjsAccessToken,
  isAuthenticatedNextjs,
  ConvexAuthNextjsServerProvider,
} = setupConvexAuthNextjs({
  convexUrl,
  refreshSession: api.auth.refreshSession,
  isAuthenticated: api.auth.isAuthenticated,
})
