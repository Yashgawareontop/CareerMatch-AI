# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

CareerMatch AI: analyzes a resume, extracts technical skills and career goals,
and recommends internships/jobs. Built in phases — `docs/phases/` holds the plan
(Phase 0 foundation is done; later phases describe the target design, exit
criteria, and dependencies). Read the relevant phase doc before starting
feature work, and `docs/architecture.md` for the target folder layout.

## Commands

Package manager is **pnpm**.

```bash
pnpm install
cp .env.example .env.local   # fill GEMINI_API_KEY and/or GROQ_API_KEY
npx convex dev               # terminal 1 — syncs convex/, regenerates convex/_generated, writes CONVEX_* vars
pnpm dev                     # terminal 2 — http://localhost:3000
pnpm lint                    # eslint
pnpm typecheck               # tsc --noEmit
pnpm format                  # prettier (no semicolons, double quotes, tailwind class sorting)
pnpm build
```

Tests (Phase 7):

```bash
pnpm test                    # Vitest: convex project (convex-test, edge runtime) + unit project
pnpm test:e2e                # Playwright main flow against the real stack (dev server + Convex + AI keys)
PW_CHANNEL=msedge pnpm test:e2e   # use an installed browser instead of `npx playwright install chromium`
```

Convex tests live next to the code as `convex/*.test.ts` and use the harness
in `tests/convex.ts` (`setup()`, `signedInUser()`); unit tests are
`lib/**/*.test.ts`. CI (`.github/workflows/ci.yml`) runs typecheck, lint,
test and build. Verify wiring with `GET /api/health` (which services are
configured) and `GET /api/health?ai=1` (a real one-word prompt; outside
`next dev` it needs the `x-jobs-sync-secret` header).

## Architecture

- **Convex is the database only.** Convex functions read/write data; they do
  not call AI or third-party APIs. The browser reads Convex directly via
  reactive `useQuery`/`useMutation` (`components/providers/convex-client-provider.tsx`,
  mounted in `app/layout.tsx`).
- **Secret/heavy work runs on the Next.js server** (route handlers / server
  actions): AI prompts (`lib/ai`), resume parsing (`lib/resume`, Phase 2),
  resume analysis (`lib/analysis`, Phase 3), job
  source adapters (`lib/jobs`, Phase 4), matching (`lib/matching`, Phase 5).
  Results are written back into Convex through mutations.
- **Env:** `lib/env.ts` exposes `serverEnv()`, a zod-validated, cached,
  `server-only` accessor (empty strings count as unset). Add new server env
  vars to its schema and to `.env.example`. Only `NEXT_PUBLIC_*` reaches the client.
- **AI abstraction:** features call `getAIProvider()` from `@/lib/ai` and never
  import `@google/genai` or `groq-sdk` directly. It picks `AI_PROVIDER`
  (default groq) as primary and the other provider (gemini) as fallback: used
  when the primary has no key, when a primary request fails, and for requests
  with `files` (Groq can't take them). The
  `AIProvider` contract in `lib/ai/types.ts` is deliberately minimal
  (`generateText` with optional `json` mode) — extend it there when a feature
  needs more. Any AI output that gets stored must be validated with a Zod schema first.
  Pass `feature` (telemetry), and `timeoutMs`/`attempts` sized to the route's
  `maxDuration`; never log a provider error without `safeErrorMessage()`.
- **Job sources:** one adapter per source in `lib/jobs/`, all normalized to a
  single `Job` shape.
- **Auth:** Convex Auth **v2** (`@convex-dev/auth@2`, a component-based
  rewrite whose API differs from 0.x. Read its source in `node_modules`, not
  memory) with username + password. Convex functions get the user from
  `getAuthUserId(ctx)` and never accept a user ID argument. The SSR wiring is
  in `lib/auth/server.ts`; any new session-minting function must be added to
  its `signIn` allowlist. `proxy.ts` (Next 16's renamed middleware) only does
  optimistic redirects, so Convex functions must still authorize.

## UI

shadcn/ui using the **base-ui** variant (`@base-ui/react`, style `base-rhea`),
Tailwind v4 (config lives in `app/globals.css`, no tailwind.config). Add
components with the shadcn CLI into `components/ui`; use `cn()` from `@/lib/utils`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
