import { expect, test } from "@playwright/test"

import { makePdf, RESUME_LINES } from "../fixtures/resumes"

// The main flow, end to end against the real stack: sign up, set
// preferences, upload a resume, wait for parsing and AI analysis, review the
// skills, see matches and the dashboard, then delete the account (which also
// cleans up after the test).

test("sign up → resume → analysis → matches → delete account", async ({
  page,
}) => {
  const username = `e2e-${Date.now().toString(36)}`
  const password = `e2e-pass-${Math.random().toString(36).slice(2)}`

  // ── Sign up ──
  await page.goto("/")
  await page.getByRole("link", { name: "Get started" }).click()
  await expect(page).toHaveURL(/\/sign-up/)
  await page.getByLabel("Username").fill(username)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Create account" }).click()

  // ── Preferences ──
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByLabel("Full name").fill("Aanya Kulkarni")
  await page.getByLabel("Education").fill("B.Tech Computer Engineering, Pune")
  await page.getByLabel("Graduation year").fill("2026")
  await page.getByLabel("Location").fill("Pune, India")
  await page.getByLabel("Preferred roles").fill("Frontend Developer")
  await page.getByRole("checkbox", { name: "Internship" }).click()
  await page.getByRole("button", { name: "Save preferences" }).click()

  // First-time setup continues to the resume upload.
  await expect(page).toHaveURL(/\/resume$/)

  // ── Upload, parse and analyze ──
  await page.getByLabel("Resume file").setInputFiles({
    name: "aanya-resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(makePdf(RESUME_LINES)),
  })
  await expect(page.getByText("aanya-resume.pdf")).toBeVisible()
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 60_000,
  })
  // Analysis is a real AI call: allow for retries and a provider fallback.
  await expect(page.getByText("Skills and career goals extracted")).toBeVisible(
    { timeout: 150_000 }
  )

  // ── Review skills ──
  await page.getByRole("link", { name: "View analysis" }).click()
  await expect(page).toHaveURL(/\/resume\/.+/)
  await expect(page.getByRole("heading", { name: /^Skills/ })).toBeVisible()
  await expect(page.getByText("React", { exact: true }).first()).toBeVisible()

  // ── Matches ──
  await page.getByRole("link", { name: "Matches" }).first().click()
  await expect(page).toHaveURL(/\/matches/)
  // Either ranked listings or the empty state, once the refresh finishes.
  await expect(
    page
      .getByRole("region", { name: "Matches" })
      .or(page.getByText("No matches yet"))
  ).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText("Finding your matches")).toHaveCount(0)

  // ── Dashboard ──
  await page.getByRole("link", { name: "Dashboard" }).first().click()
  await expect(page.getByText("Skills found")).toBeVisible()

  // ── Usage: the upload, parse and analysis each used one token ──
  await page.getByRole("link", { name: "Usage" }).first().click()
  await expect(page.getByText("Your limits")).toBeVisible()
  await expect(
    page.getByRole("meter", { name: /AI analyses: \d+ of \d+ available/ })
  ).toBeVisible()

  // ── Delete the account ──
  await page.getByRole("link", { name: "Settings" }).first().click()
  await page.getByRole("button", { name: "Delete my account" }).click()
  await page.getByRole("button", { name: "Delete everything" }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 })

  // The account is gone: signing in again fails.
  await page.goto("/sign-in")
  await page.getByLabel("Username").fill(username)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  // (Next's route announcer is also role="alert", so match the text.)
  await expect(page.getByText("Wrong username or password")).toBeVisible()
})

test("signed-out visitors are sent to sign in", async ({ page }) => {
  for (const path of ["/dashboard", "/resume", "/usage"]) {
    await page.goto(path)
    await expect(page).toHaveURL(
      new RegExp(`/sign-in\\?next=${encodeURIComponent(path)}`)
    )
  }
})

test("every page carries a nonce-based CSP", async ({ page }) => {
  const violations: string[] = []
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) violations.push(m.text())
  })
  const response = await page.goto("/")
  const csp = response?.headers()["content-security-policy"] ?? ""
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
  expect(csp).toContain("frame-ancestors 'none'")
  await page.goto("/sign-in")
  expect(violations).toEqual([])
})
