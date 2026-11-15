import "server-only"

import { withRetry } from "@/lib/ai/retry"

const TIMEOUT_MS = 15_000
const USER_AGENT = "CareerMatchAI/0.1 (job aggregator)"

/** A non-2xx response, with its status and headers for the retry policy. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly headers: Headers,
    message: string
  ) {
    super(message)
    this.name = "HttpError"
  }
}

/** Counts requests so each sync can log calls against free quotas. */
export class CallCounter {
  calls = 0

  /**
   * GET/POST JSON with a 15 s timeout per attempt. A 429, 5xx or timeout is
   * retried once after a backoff (or the server's Retry-After); every
   * attempt counts as a call, since it counts against the source's quota.
   */
  async json(url: string | URL, init?: RequestInit): Promise<unknown> {
    return withRetry(
      async () => {
        this.calls++
        const response = await fetch(url, {
          ...init,
          headers: {
            accept: "application/json",
            "user-agent": USER_AGENT,
            ...init?.headers,
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        })
        if (!response.ok) {
          throw new HttpError(
            response.status,
            response.headers,
            `${response.status} ${response.statusText} from ${new URL(url).host}`
          )
        }
        return response.json()
      },
      { attempts: 2, baseDelayMs: 2000, maxDelayMs: 15_000 }
    )
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
