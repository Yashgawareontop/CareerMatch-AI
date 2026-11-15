# CareerMatch AI

AI-powered career assistant that reads your resume, understands your technical
skills and career goals, and recommends the internships and jobs that fit you
best, with a plain-language reason for every match.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
shadcn/ui (base-ui) · Convex · Convex Auth · Groq / Google Gemini · Zod · Vitest · Playwright

---

## Features

- **Accounts & onboarding**: username + password sign-up (Convex Auth v2),
  plus a preferences form for education, graduation year, location, preferred
  roles, job types and target industries.
- **Resume upload & parsing**: PDF and DOCX up to 5 MB, stored in Convex file
  storage. The real file type is checked, then text is extracted with `unpdf` /
  `mammoth`. Scanned PDFs are read by Gemini. Parse status updates live.
- **AI resume analysis**: structured, Zod-validated output covering skills
  (category, level, evidence), experience, projects, education, seniority,
  inferred roles, career goals, summary, strengths and gaps. Skill names are
  normalized through an alias map and the ESCO taxonomy, and you can edit the
  extracted skills yourself.
- **Job & internship ingestion**: adapters for Arbeitnow, Himalayas,
  Remote OK, Remotive, Adzuna and Jooble, all normalized to one `Job` shape.
  Listings are de-duplicated, expired after 30 days and classified by level and
  type (keyword rules first, a small Groq model for unclear cases). A daily
  Convex cron runs the sync.
- **Matching & recommendations**: Gemini embeddings and Convex vector search
  find candidates, which are then scored on semantic similarity, skill overlap
  and preferences. The top matches get an AI explanation and a list of missing
  skills.
- **Dashboard & UX**: getting-started checklist, profile summary, a
  skills-by-category chart, strengths and gaps, top matches, filterable job
  list with a detail drawer, an application tracker (saved / applied / hidden),
  settings with full account deletion, dark mode, and loading, empty and error
  states throughout.
- **Hardening**: nonce-based CSP, security headers, per-user rate limits
  and quotas (`/usage`), AI retries with backoff and provider fallback, redacted
  error logging, AI call telemetry, an access-control test suite and CI.

## Architecture

```
Browser (Next.js client components)
   │  useQuery / useMutation (realtime)          fetch (route handlers)
   ▼                                                   ▼
Convex ── database only ◄──────── mutations ──── Next.js server
  users, profiles, resumes,                        ├─ lib/ai        Groq / Gemini (+ fallback)
  analyses, jobs, jobEmbeddings,                   ├─ lib/resume    PDF / DOCX → text
  matches, feedback, aiCalls                       ├─ lib/analysis  resume → structured profile
                                                   ├─ lib/jobs      job source adapters + sync
                                                   └─ lib/matching  embeddings, scoring, explanations
```

- **Convex is the database.** Its functions only read and write data. The
  browser reads it directly through reactive queries.
- **Secret and heavy work runs on the Next.js server**: AI prompts, parsing,
  third-party job APIs and matching. Results are written back to Convex.
- **One AI abstraction.** Features call `getAIProvider()` from `@/lib/ai`.
  `AI_PROVIDER` (default `groq`) is the primary and the other provider is the
  fallback. Every stored AI output is validated with Zod first.
- **Auth.** Convex functions get the user from `getAuthUserId(ctx)` and never
  accept a user ID argument. `proxy.ts` (Next 16's middleware) only does
  optimistic redirects. Real authorization happens in Convex.

See [`docs/architecture.md`](./docs/architecture.md) for the full folder layout
and request flows.

## Project structure

```
app/                 # routes: landing, (auth), onboarding, resume, dashboard,
                     # jobs, matches, tracker, settings, usage, api/*
components/          # feature components + ui/ (shadcn)
convex/              # schema, queries/mutations, crons, rate limits, tests
lib/
  ai/                # provider abstraction, retry, telemetry, embeddings
  resume/            # text extraction + cleanup
  analysis/          # analysis prompt, schema, skill normalization
  jobs/              # source adapters, classification, sync
  matching/          # scoring + explanations
  security/, usage/  # CSP, quota math
tests/               # convex-test harness, fixtures, Playwright e2e
docs/                # architecture, phase plans, resources, security audit
```

## Getting started

**Requirements:** Node.js ≥ 20.9, pnpm 10, a free [Convex](https://convex.dev)
account, and at least one AI key:
[Groq](https://console.groq.com/keys) and/or
[Gemini](https://aistudio.google.com/apikey). Gemini is needed for embeddings
and scanned PDFs.

```bash
pnpm install
cp .env.example .env.local   # fill GROQ_API_KEY / GEMINI_API_KEY and the secrets
npx convex dev               # terminal 1: syncs convex/, writes CONVEX_* vars
pnpm dev                     # terminal 2: http://localhost:3000
```

Set the shared secrets on Convex as well (see the comments in `.env.example`):

```bash
npx convex env set RESUME_PARSER_SECRET <value>
npx convex env set JOBS_SYNC_SECRET <value>
npx convex env set JOBS_SYNC_URL https://your-app.example.com   # for the daily cron
```

Check the wiring:

- `GET /api/health`: which services are configured
- `GET /api/health?ai=1`: sends a real one-word prompt. Outside `next dev`
  it needs the `x-jobs-sync-secret` header.

## Scripts

| Command          | What it does                                              |
| ---------------- | --------------------------------------------------------- |
| `pnpm dev`       | Start the Next.js dev server                              |
| `pnpm build`     | Production build                                          |
| `pnpm lint`      | ESLint                                                    |
| `pnpm typecheck` | `tsc --noEmit`                                            |
| `pnpm format`    | Prettier (with Tailwind class sorting)                    |
| `pnpm test`      | Vitest: unit tests + Convex tests (convex-test)           |
| `pnpm test:e2e`  | Playwright main flow against the real stack               |

Use `PW_CHANNEL=msedge pnpm test:e2e` to run end-to-end tests in an installed
browser instead of downloading Chromium.

## Environment variables

All variables are documented in [`.env.example`](./.env.example). The main
ones:

| Variable                          | Purpose                                     |
| --------------------------------- | ------------------------------------------- |
| `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` | Written by `npx convex dev`     |
| `AI_PROVIDER`                     | `groq` (default) or `gemini`                |
| `GROQ_API_KEY`, `GEMINI_API_KEY`  | AI providers                                |
| `RESUME_PARSER_SECRET`            | Server ↔ Convex shared secret               |
| `JOBS_SYNC_SECRET`                | Protects `POST /api/jobs/sync`              |
| `ADZUNA_*`, `JOOBLE_API_KEY`      | Optional job sources (skipped when unset)   |

Never commit real keys. `.env*` is git-ignored except `.env.example`.

## Development phases

The project was built in phases. Each one has a plan with goals and exit
criteria in [`docs/phases/`](./docs/phases):

| Phase | Scope                                  |
| ----- | -------------------------------------- |
| 0     | Foundation: env, AI abstraction, health check |
| 1     | Auth & user profile                    |
| 2     | Resume upload & parsing                |
| 3     | AI skill & career-goal analysis        |
| 4     | Job & internship ingestion             |
| 5     | Matching & recommendations             |
| 6     | Dashboard & UX                         |
| 7     | Hardening, testing & launch prep       |

## Data sources & credits

Job listings come from public APIs: Arbeitnow, Himalayas, Remote OK,
Remotive, and, with keys, Adzuna and Jooble. Source credits are shown wherever
their jobs appear, as their terms require. Skill normalization uses the
[ESCO](https://esco.ec.europa.eu/) API. See [`docs/resources.md`](./docs/resources.md).

## Privacy

Resume text is sent to the configured AI provider for analysis. Provider
errors are scrubbed of model output before logging, and AI telemetry records
only metadata (provider, model, latency, tokens), never content. Users can
delete their account and all of their data from Settings.
