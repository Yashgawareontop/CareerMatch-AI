// Content Security Policy, built per request in proxy.ts with a fresh nonce.
// Pure (no Next.js imports) so it is unit-tested directly.

export interface CspOptions {
  nonce: string
  /** `next dev`: React needs eval for its debug stacks, and HMR a websocket. */
  dev: boolean
  /** NEXT_PUBLIC_CONVEX_URL; the browser talks to it over https and wss. */
  convexUrl?: string
}

/**
 * Scripts: only Next's own, carrying this request's nonce ('strict-dynamic'
 * lets those load their chunks). Styles allow inline because React `style`
 * attributes (chart bars, progress widths) can't carry a nonce. No frames,
 * plugins or foreign form targets. Connections only to this app and Convex.
 */
export function buildCsp({ nonce, dev, convexUrl }: CspOptions): string {
  const convex = convexOrigins(convexUrl)
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...convex, ...(dev ? ["ws:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  }
  const policy = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.join(" ")}`
  )
  // Upgrading would break plain-http localhost during development.
  if (!dev) policy.push("upgrade-insecure-requests")
  return policy.join("; ")
}

function convexOrigins(url?: string): string[] {
  if (!url) return []
  try {
    const { host } = new URL(url)
    return [`https://${host}`, `wss://${host}`]
  } catch {
    return []
  }
}

/** A fresh, unguessable nonce for one response. */
export function createNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}
