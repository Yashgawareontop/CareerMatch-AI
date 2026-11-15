import { describe, expect, test, vi } from "vitest"

import {
  backoffDelay,
  errorStatus,
  isRetryable,
  retryAfterMs,
  withRetry,
} from "./retry"

const withStatus = (status: number, extra: object = {}) =>
  Object.assign(new Error(`HTTP ${status}`), { status, ...extra })

describe("isRetryable", () => {
  test("rate limits, server errors and network failures", () => {
    expect(isRetryable(withStatus(429))).toBe(true)
    expect(isRetryable(withStatus(503))).toBe(true)
    expect(isRetryable(new Error("fetch failed"))).toBe(true)
    expect(
      isRetryable(Object.assign(new Error("x"), { name: "TimeoutError" }))
    ).toBe(true)
  })

  test("not client errors or daily quotas", () => {
    expect(isRetryable(withStatus(400))).toBe(false)
    expect(isRetryable(withStatus(401))).toBe(false)
    expect(isRetryable(new Error("429 Quota exceeded: requests per day"))).toBe(
      false
    )
  })

  test("reads a status from the message when there is no field", () => {
    expect(errorStatus(new Error("got 503 from api.example.com"))).toBe(503)
  })
})

describe("retryAfterMs", () => {
  test("Retry-After header in seconds", () => {
    expect(
      retryAfterMs(withStatus(429, { headers: { "retry-after": "3" } }))
    ).toBe(3000)
    expect(
      retryAfterMs(
        withStatus(429, { headers: new Headers({ "retry-after": "1.5" }) })
      )
    ).toBe(1500)
  })

  test("Gemini's hint in the message", () => {
    expect(retryAfterMs(new Error("429 ... Please retry in 12.4s."))).toBe(
      12400
    )
    expect(retryAfterMs(new Error('{"retryDelay":"7s"}'))).toBe(7000)
  })
})

describe("backoffDelay", () => {
  test("doubles each retry, with jitter in the upper half", () => {
    const err = withStatus(503)
    expect(backoffDelay(0, err, { random: () => 0 })).toBe(500)
    expect(backoffDelay(0, err, { random: () => 1 })).toBe(1000)
    expect(backoffDelay(2, err, { random: () => 1 })).toBe(4000)
  })

  test("caps the wait, even when the server asks for longer", () => {
    expect(backoffDelay(10, withStatus(503), { random: () => 1 })).toBe(10_000)
    expect(
      backoffDelay(0, withStatus(429, { headers: { "retry-after": "120" } }))
    ).toBe(10_000)
  })
})

describe("withRetry", () => {
  test("retries until success and reports each wait", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {})
    const onRetry = vi.fn()
    let calls = 0
    const result = await withRetry(
      async () => {
        if (++calls < 3) throw withStatus(429)
        return "ok"
      },
      { sleep, onRetry, random: () => 0 }
    )
    expect(result).toBe("ok")
    expect(calls).toBe(3)
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1000])
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  test("stops at once on an error that won't go away", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {})
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls++
          throw withStatus(400)
        },
        { sleep }
      )
    ).rejects.toThrow("HTTP 400")
    expect(calls).toBe(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  test("gives up after the last attempt with the last error", async () => {
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls++
          throw withStatus(503)
        },
        { attempts: 2, sleep: async () => {} }
      )
    ).rejects.toThrow("HTTP 503")
    expect(calls).toBe(2)
  })
})
