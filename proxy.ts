import { NextResponse, type NextRequest } from "next/server"

import { convexAuthNextjsProxy, nextjsProxyRedirect } from "@/lib/auth/server"
import { buildCsp, createNonce } from "@/lib/security/csp"

// Optimistic checks only: Convex functions still authorize every request.
const PROTECTED = [
  "/dashboard",
  "/onboarding",
  "/resume",
  "/matches",
  "/jobs",
  "/tracker",
  "/settings",
  "/usage",
]
const SIGNED_OUT_ONLY = ["/sign-in", "/sign-up"]

const matches = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/**
 * Every page gets a Content Security Policy with a fresh nonce. Next.js
 * reads the nonce from the request's CSP header and puts it on its own
 * scripts; the root layout passes it to the theme script via `x-nonce`.
 */
function withCsp(request: NextRequest) {
  const nonce = createNonce()
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV === "development",
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
  })
  const headers = new Headers(request.headers)
  headers.set("x-nonce", nonce)
  headers.set("content-security-policy", csp)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set("content-security-policy", csp)
  return response
}

// Refreshes the session cookie up front, redirects by auth state, and
// otherwise continues with the CSP headers set.
export const proxy = convexAuthNextjsProxy(async (request, ctx) => {
  const { pathname } = request.nextUrl

  if (matches(pathname, PROTECTED) && !(await ctx.isAuthenticated())) {
    return nextjsProxyRedirect(
      request,
      `/sign-in?next=${encodeURIComponent(pathname)}`
    )
  }
  if (matches(pathname, SIGNED_OUT_ONLY) && (await ctx.isAuthenticated())) {
    return nextjsProxyRedirect(request, "/dashboard")
  }
  return withCsp(request)
})

export const config = {
  // Skip static assets, API routes, and the /auth/* handlers (they manage
  // the session cookies themselves).
  matcher: ["/((?!_next/|api/|auth/|.*\\..*).*)"],
}
