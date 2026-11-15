# CareerMatch AI — Project Docs

CareerMatch AI analyzes a user's resume, understands their technical skills and
career goals, and recommends relevant internships and jobs using AI.

## Stack

| Layer     | Choice                                         |
| --------- | ---------------------------------------------- |
| Framework | Next.js 16 (App Router) + React 19, TypeScript |
| Styling   | Tailwind CSS v4 + shadcn/ui (base-ui)          |
| Database  | Convex (database only; AI runs in Next.js)     |
| AI        | Google Gemini (primary), Groq (fallback/fast)  |
| Validation| Zod v4                                         |

> **Convex is the database only.** All AI calls and third-party job API calls
> run on the Next.js server (route handlers / server actions) through
> `lib/ai` and `lib/jobs`. Convex functions only read and write data.

## Documents

- [Architecture & folder structure](./architecture.md)
- [Free & open-source resources](./resources.md)
- Phases:
  - [Phase 0 — Foundation (done)](./phases/phase-0-foundation.md)
  - [Phase 1 — Auth & user profile (done)](./phases/phase-1-auth-and-profile.md)
  - [Phase 2 — Resume upload & parsing](./phases/phase-2-resume-parsing.md)
  - [Phase 3 — AI skill & goal analysis](./phases/phase-3-ai-analysis.md)
  - [Phase 4 — Job & internship ingestion](./phases/phase-4-job-ingestion.md)
  - [Phase 5 — Matching & recommendations](./phases/phase-5-matching.md)
  - [Phase 6 — Dashboard & UX](./phases/phase-6-dashboard-ux.md)
  - [Phase 7 — Hardening, testing & launch](./phases/phase-7-hardening-launch.md)

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in keys
npx convex dev               # terminal 1 — syncs Convex, writes CONVEX_* vars
pnpm dev                     # terminal 2 — http://localhost:3000
```

Check the wiring:

- `GET /api/health` — shows whether Convex and the AI providers are configured
- `GET /api/health?ai=1` — also sends a one-word test prompt to the AI provider
