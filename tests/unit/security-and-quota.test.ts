import { describe, expect, test } from "vitest"

import { dedupeKey } from "@/lib/jobs/sync"
import { ruleLevel, ruleType } from "@/lib/jobs/classify"
import { buildCsp, createNonce } from "@/lib/security/csp"
import { availableTokens, msUntilNextToken } from "@/lib/usage/quota"

const HOUR = 60 * 60 * 1000

describe("Content Security Policy", () => {
  const convexUrl = "https://happy-otter-123.convex.cloud"

  test("production: nonce scripts only, no eval, no framing", () => {
    const csp = buildCsp({ nonce: "abc", dev: false, convexUrl })
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'")
    expect(csp).not.toContain("unsafe-eval")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("upgrade-insecure-requests")
    expect(csp).toContain(
      "connect-src 'self' https://happy-otter-123.convex.cloud wss://happy-otter-123.convex.cloud"
    )
  })

  test("development allows eval and the HMR socket", () => {
    const csp = buildCsp({ nonce: "abc", dev: true, convexUrl })
    expect(csp).toContain("'unsafe-eval'")
    expect(csp).toMatch(/connect-src [^;]* ws:/)
    expect(csp).not.toContain("upgrade-insecure-requests")
  })

  test("nonces are fresh and unguessable", () => {
    const a = createNonce()
    const b = createNonce()
    expect(a).not.toBe(b)
    expect(atob(a)).toHaveLength(16)
  })
})

describe("quota math", () => {
  const bucket = { rate: 10, period: HOUR, capacity: 3 }

  test("a never-used bucket is full", () => {
    expect(availableTokens({ ...bucket, value: 3, ts: 0 }, 1_000)).toBe(3)
    expect(msUntilNextToken({ ...bucket, value: 3, ts: 0 }, 1_000)).toBe(0)
  })

  test("refills at rate/period up to capacity", () => {
    const t0 = 1_000_000
    const empty = { ...bucket, value: 0, ts: t0 }
    expect(availableTokens(empty, t0)).toBe(0)
    expect(msUntilNextToken(empty, t0)).toBe(HOUR / 10)
    expect(availableTokens(empty, t0 + HOUR / 10)).toBe(1)
    expect(availableTokens(empty, t0 + 10 * HOUR)).toBe(3)
  })
})

describe("job classification rules", () => {
  test("levels from titles", () => {
    expect(ruleLevel("Software Engineering Intern")).toBe("intern")
    expect(ruleLevel("Senior Backend Engineer")).toBe("senior")
    expect(ruleLevel("Junior Web Developer")).toBe("entry")
    expect(ruleLevel("Frontend Developer")).toBeNull()
  })

  test("an internship level makes an internship", () => {
    const raw = {
      source: "remotive" as const,
      externalId: "1",
      title: "Data Intern",
      company: "X",
      location: "Remote",
      remote: true,
      description: "",
      url: "https://x",
      postedAt: 0,
      tags: [],
    }
    expect(ruleType(raw, "intern")).toBe("internship")
    expect(ruleType({ ...raw, title: "Part-time QA Tester" }, "entry")).toBe(
      "part-time"
    )
  })

  test("reposts across sources share a dedupe key", () => {
    const a = dedupeKey({
      title: "Frontend Developer (m/w/d)",
      company: "Fieldnote GmbH",
      source: "arbeitnow",
      externalId: "a",
    })
    const b = dedupeKey({
      title: "frontend developer",
      company: "Fieldnote  GmbH",
      source: "himalayas",
      externalId: "b",
    })
    expect(a).toBe(b)
  })
})

describe("log redaction", () => {
  test("drops model output from provider errors", async () => {
    const { safeErrorMessage } = await import("@/lib/ai/redact")
    const groq = new Error(
      '400 {"error":{"message":"Failed to generate JSON","code":"json_validate_failed","failed_generation":"{\\"summary\\":\\"Aanya Kulkarni, Pune...'
    )
    const safe = safeErrorMessage(groq)
    expect(safe).toContain("json_validate_failed")
    expect(safe).not.toContain("Aanya")
    expect(safeErrorMessage("x".repeat(1000))).toHaveLength(300)
  })
})
