# Phase 0 — Foundation ✅ (done)

**Goal:** an empty but correctly wired project, ready for features.

## Done
- Next.js 16 + React 19 + TypeScript + Tailwind v4 + shadcn/ui
- Convex initialised (`convex/`, `.env.local` from `npx convex dev`)
- `ConvexClientProvider` wraps the app (`components/providers/`)
- Dependencies: `@google/genai`, `groq-sdk`, `zod`, `server-only`
- `lib/env.ts`: zod-validated, server-only env vars
- `lib/ai/`: one `AIProvider` interface with Gemini and Groq implementations,
  and `getAIProvider()` with automatic fallback
- `.env.example` documenting every variable (unignored in `.gitignore`)
- `GET /api/health[?ai=1]` integration check
- Docs: architecture, resources, phase plans

## Out of scope (by design)
No schema, no features, no UI, no deployment.

## Exit criteria
- `pnpm typecheck` and `pnpm lint` pass ✅
- `/api/health` returns `{"convex":true,...}` ✅
- `/api/health?ai=1` returns a reply once an API key is set
