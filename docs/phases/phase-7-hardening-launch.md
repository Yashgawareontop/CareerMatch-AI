# Phase 7 — Hardening, Testing & Launch Prep

**Status: built (2026-11-15).** Exit criteria met locally: typecheck, lint,
58 unit and Convex tests, the production build and the 3 Playwright tests
pass. The access audit ([`docs/security-audit.md`](../security-audit.md)) has
no high-severity findings. CI runs on GitHub Actions; its end-to-end job needs
repository secrets for a test Convex deployment (listed in
`.github/workflows/ci.yml`) and is skipped until they are added.

- **Security:** access audit enforced by `convex/access.test.ts`; nonce-based
  CSP per request in `proxy.ts` plus static security headers in
  `next.config.ts`; `/api/health?ai=1` now needs the ops header outside dev.
- **Privacy:** provider errors are scrubbed of model output before logging
  (`lib/ai/redact.ts`).
- **Resilience:** `lib/ai/retry.ts` retries 429/5xx/timeouts with jittered
  exponential backoff (or the server's Retry-After), with a per-attempt
  timeout. With two providers, the primary is tried once, then the fallback
  gets the retries. Job APIs retry once (`lib/jobs/http.ts`). `/jobs` says
  which sources failed in the last refresh.
- **Observability:** one JSON log line plus an `aiCalls` row per AI request
  (provider, model, feature, latency, tokens; never content), pruned after
  30 days. `/usage` shows each user's remaining limits, and service-wide AI
  usage to `ADMIN_USER_IDS`.
- **Testing:** Vitest (`pnpm test`) with a `convex` project (convex-test,
  edge runtime) and a `unit` project: parsers on generated PDF/DOCX files,
  scoring, adapters on recorded responses (`tests/fixtures/jobs`), retry, CSP,
  quota math. Playwright (`pnpm test:e2e`) runs the main flow on the real stack.

**Goal:** make the app safe, tested and ready to deploy. The deployment itself is a separate step.

## Tasks
- **Security:** audit Convex access rules (every resume, analysis and match
  needs an owner check), validate uploads, limit AI requests per user, keep
  secrets on the server, and add a Content Security Policy.
- **Privacy:** tell users that resumes are sent to Gemini or Groq, let them
  delete their data, and never log resume text.
- **Testing:** use Vitest and `convex-test` for Convex functions. Write unit
  tests for the parsers, the scoring, and the job adapters (with recorded
  sample responses). Use Playwright for an end-to-end test of the main flow.
- **Resilience:** retry with backoff on 429 errors, switch provider on
  failure, add timeouts to job API calls, and show partial results in the UI
  when a source fails.
- **Observability:** log each AI call's provider, model, latency and token
  count, but not its content. Add a page that shows quota usage.
- **CI:** a GitHub Actions workflow that runs typecheck, lint, tests and build.

## Exit criteria
- CI passes, the access audit has no high-severity findings, and the end-to-end test passes
