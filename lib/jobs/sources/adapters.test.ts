// Job adapters against recorded responses (tests/fixtures/jobs, trimmed to a
// few items from real API calls), plus the shared HTTP client's retries.

import { readFileSync } from "node:fs"

import { afterEach, describe, expect, test, vi } from "vitest"

import { CallCounter, HttpError } from "../http"
import type { RawJob, SourceAdapter } from "../types"

import { adzuna } from "./adzuna"
import { arbeitnow } from "./arbeitnow"
import { himalayas } from "./himalayas"
import { jooble } from "./jooble"
import { remoteok } from "./remoteok"
import { remotive } from "./remotive"

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`../../../tests/fixtures/jobs/${name}.json`, import.meta.url),
      "utf8"
    )
  )

/** Serves a fixture for URLs containing `match`, an empty body otherwise. */
function serve(match: string, body: unknown, empty: unknown) {
  const fetchMock = vi.fn(async (url: string | URL) => {
    const hit = String(url).includes(match)
    return new Response(JSON.stringify(hit ? body : empty), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function expectNormalised(jobs: RawJob[], source: string) {
  expect(jobs.length).toBeGreaterThan(0)
  for (const j of jobs) {
    expect(j.source).toBe(source)
    expect(j.externalId).toEqual(expect.any(String))
    expect(j.externalId.length).toBeGreaterThan(0)
    expect(j.title.trim()).toBe(j.title)
    expect(j.title.length).toBeGreaterThan(0)
    expect(j.url).toMatch(/^https?:\/\//)
    expect(Number.isFinite(j.postedAt)).toBe(true)
    expect(j.postedAt).toBeGreaterThan(Date.UTC(2020, 0, 1))
    expect(typeof j.remote).toBe("boolean")
    expect(j.description).not.toMatch(/<\/?(p|div|br|li|ul|strong)\b/i)
  }
}

async function run(adapter: SourceAdapter) {
  const pending = adapter.fetch()
  // Paginated adapters sleep between pages; skip the waits.
  await vi.runAllTimersAsync()
  return await pending
}

describe("keyless sources", () => {
  test("remotive", async () => {
    vi.useFakeTimers()
    const fetchMock = serve("software-dev", fixture("remotive"), { jobs: [] })
    const result = await run(remotive)
    expectNormalised(result.jobs, "remotive")
    expect(result.jobs.every((j) => j.remote)).toBe(true)
    expect(result.calls).toBe(fetchMock.mock.calls.length)
  })

  test("arbeitnow", async () => {
    vi.useFakeTimers()
    const data = fixture("arbeitnow") as { data: unknown[] }
    serve("page=1", { ...data, links: { next: null } }, { data: [] })
    const result = await run(arbeitnow)
    expectNormalised(result.jobs, "arbeitnow")
    expect(result.calls).toBe(1)
  })

  test("himalayas", async () => {
    vi.useFakeTimers()
    serve("offset=0", fixture("himalayas"), { jobs: [] })
    const result = await run(himalayas)
    expectNormalised(result.jobs, "himalayas")
  })

  test("remoteok skips its legal notice", async () => {
    vi.useFakeTimers()
    const raw = fixture("remoteok") as unknown[]
    serve("remoteok.com/api", raw, [])
    const result = await run(remoteok)
    expectNormalised(result.jobs, "remoteok")
    expect(result.jobs).toHaveLength(raw.length - 1)
  })
})

describe("keyed sources", () => {
  test("are skipped without keys, with no requests", async () => {
    const fetchMock = serve("", {}, {})
    for (const adapter of [adzuna, jooble]) {
      const result = await adapter.fetch()
      expect(result.jobs).toEqual([])
      expect(result.calls).toBe(0)
      expect("skipped" in result && result.skipped).toBeTruthy()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("CallCounter", () => {
  test("retries a 429 once, honouring Retry-After, and counts both calls", async () => {
    let n = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ++n === 1
          ? new Response("slow down", {
              status: 429,
              statusText: "Too Many Requests",
              headers: { "retry-after": "0" },
            })
          : Response.json({ ok: true })
      )
    )
    const http = new CallCounter()
    expect(await http.json("https://example.com/api")).toEqual({ ok: true })
    expect(http.calls).toBe(2)
  })

  test("does not retry a 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response("", { status: 404, statusText: "Not Found" })
      )
    )
    const http = new CallCounter()
    await expect(http.json("https://example.com/api")).rejects.toBeInstanceOf(
      HttpError
    )
    expect(http.calls).toBe(1)
  })

  test("gives up after the second server error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("", {
            status: 503,
            statusText: "Unavailable",
            headers: { "retry-after": "0" },
          })
      )
    )
    const http = new CallCounter()
    await expect(http.json("https://example.com/api")).rejects.toThrow(/503/)
    expect(http.calls).toBe(2)
  })
})
