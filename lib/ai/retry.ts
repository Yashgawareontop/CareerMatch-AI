// Retry policy for AI and job API calls. Pure (no I/O besides the sleep), so
// it is unit-tested directly.

export interface RetryOptions {
  /** Total attempts including the first. Default 3. */
  attempts?: number
  /** First backoff delay; doubles each retry. Default 1000 ms. */
  baseDelayMs?: number
  /** No single wait is longer than this. Default 10 s. */
  maxDelayMs?: number
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>
  /** Injected for tests; returns 0–1. */
  random?: () => number
  /** Called before each wait, e.g. to log the retry. */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void
}

/** HTTP-ish status of an SDK error (`status` or `code`), if any. */
export function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined
  const e = error as { status?: unknown; code?: unknown }
  if (typeof e.status === "number") return e.status
  if (typeof e.code === "number") return e.code
  const text = error instanceof Error ? error.message : ""
  const match = text.match(/\b(429|500|502|503|504)\b/)
  return match ? Number(match[1]) : undefined
}

/**
 * Whether a failed call is worth repeating: rate limits (429), server errors
 * (5xx), timeouts and dropped connections. Bad requests, auth errors and
 * daily quotas are not, since another try would fail the same way.
 */
export function isRetryable(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : ""
  if (/per ?day|PerDay|quota exceeded for .*day/i.test(text)) return false
  const status = errorStatus(error)
  if (status !== undefined) return status === 429 || status >= 500
  return /timeout|timed out|aborted|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up/i.test(
    text
  )
}

/**
 * How long the server asked us to wait, in ms: a Retry-After header, or
 * Gemini's "retry in 12.3s" / "retryDelay":"12s" hints. Undefined if none.
 */
export function retryAfterMs(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const headers = (error as { headers?: unknown }).headers
    const value =
      headers instanceof Headers
        ? headers.get("retry-after")
        : typeof headers === "object" && headers !== null
          ? (headers as Record<string, unknown>)["retry-after"]
          : undefined
    if (typeof value === "string" || typeof value === "number") {
      const seconds = Number(value)
      if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
      const date = Date.parse(String(value))
      if (!Number.isNaN(date)) return Math.max(0, date - Date.now())
    }
  }
  const text = error instanceof Error ? error.message : String(error ?? "")
  const match =
    text.match(/retry in ([\d.]+)\s*s/i) ??
    text.match(/"retryDelay":"([\d.]+)s"/)
  return match ? Math.ceil(Number(match[1]) * 1000) : undefined
}

/** Exponential backoff with full jitter, or the server's own hint. */
export function backoffDelay(
  retry: number,
  error: unknown,
  {
    baseDelayMs = 1000,
    maxDelayMs = 10_000,
    random = Math.random,
  }: RetryOptions = {}
): number {
  const hinted = retryAfterMs(error)
  if (hinted !== undefined) return Math.min(hinted, maxDelayMs)
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** retry)
  // Full jitter, but never less than half the step, so retries spread out
  // without collapsing to zero.
  return Math.round(ceiling / 2 + (random() * ceiling) / 2)
}

/** Runs `fn` with retries on retryable errors; rethrows the last error. */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3)
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error
      if (attempt === attempts || !isRetryable(error)) throw error
      const delayMs = backoffDelay(attempt - 1, error, options)
      options.onRetry?.({ attempt, delayMs, error })
      await sleep(delayMs)
    }
  }
  throw lastError
}
