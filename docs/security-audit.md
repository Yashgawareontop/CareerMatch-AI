# Access audit (Phase 7)

**Date:** 2026-11-15 · **Result: no high-severity findings.** The access rules
are enforced by tests: `convex/access.test.ts` (convex-test, run in CI).

## How access works

Every public Convex function falls into one of three groups:

| Group | Check | Functions |
| --- | --- | --- |
| **The user's own data** | `requireUserId` / `getAuthUserId` from the session (never an argument), then the row's `userId` must match | `resumes.*Mine`, `remove`, `startParsing`, `create`, `generateUploadUrl` · `analyses.start`, `updateSkills`, `getMine`, `latestForMyResume`, `historyForMyResume`, `latestDoneMine` · `matches.begin`, `mine`, `forJob`, `setFeedback`, `myFeedback` · `profiles.*Mine` · `account.deleteMine` · `usage.myLimits` · `users.viewer` |
| **Server only** | `requireServerSecret` (`RESUME_PARSER_SECRET`, constant-time compare). Only the Next.js server holds it | `resumes.completeParsing`, `failParsing` · `analyses.complete`, `fail` · `matches.recall`, `complete`, `fail` · `jobs.knownIds`, `upsertBatch`, `expireBatch`, `pendingEmbeddings`, `setEmbeddings`, `recordRun`, `recentRuns` · `skillCache.*` · `aiCalls.record`, `summary` |
| **Public by design** | None: job listings are public data | `jobs.list`, `browse`, `get`, `search`, `lastSync` (source names only, no error text) |

Two more: `usage.service` returns service-wide AI usage only to user ids
listed in `ADMIN_USER_IDS` on the Convex deployment, and `null` to everyone
else. Internal functions (`users.createUser`, `jobs.countBySource`,
`aiCalls.prune`, `jobsCron.triggerSync`) can't be called from outside.

Ownership failures return `null` / an empty list for reads and the same
"not found" error as a missing row for writes, so another user's ids can't be
probed.

## What the tests prove

- Another user can't read, list, delete or start parsing my resume, read or
  edit my analysis, see my matches, or see or clear my feedback.
- Signed-out callers get nothing and can't request upload URLs.
- Parsed text, analysis results and match results can only be written with
  the server secret; a wrong secret is refused for every server-only function.
- Deleting an account removes that user's resumes (and stored files),
  analyses, feedback and user row, revokes their sessions, and leaves other
  users' data alone.
- Usage: each user sees only their own limits; service usage is admin-only.

## Next.js routes

| Route | Protection |
| --- | --- |
| `POST /api/resume/parse`, `/analyze`, `/api/matches/refresh` | The user's Convex token; the first Convex call checks ownership and the rate limit |
| `POST /api/jobs/sync`, `/api/jobs/embed` | `x-jobs-sync-secret` header, constant-time compare; sync has a 20 h cooldown |
| `GET /api/health` | Config flags only. `?ai=1` spends AI quota, so outside `next dev` it needs the `x-jobs-sync-secret` header **(fixed in this phase: it was open)** |

## Other controls

- **Uploads:** at most 5 MB and PDF or DOCX, checked in `resumes.create`. The
  parser then checks the real type from the bytes (`file-type`), never the name.
- **AI cost limits** (per user, `convex/rateLimits.ts`): uploads 20/h
  (burst 5), parses 10 per 10 min (burst 5), analyses 10/h (burst 3), match
  refreshes 12/h (burst 4). Users see what's left on `/usage`.
- **Secrets** stay on the server: `lib/env.ts` is `server-only`, and only
  `NEXT_PUBLIC_CONVEX_URL` reaches the browser.
- **Content Security Policy** per request with a nonce (`proxy.ts`,
  `lib/security/csp.ts`): scripts need the nonce, no `eval` in production, no
  framing, plugins or foreign form targets, connections only to the app and
  Convex. Static headers in `next.config.ts`: `nosniff`, `X-Frame-Options:
  DENY`, a strict referrer policy, a permissions policy, and HSTS in production.
- **Privacy:** resume text is never logged. AI telemetry stores metadata only
  (provider, model, feature, latency, tokens). Provider error messages pass
  through `safeErrorMessage()` before logging, which removes Groq's
  `failed_generation` (model output derived from the resume) **(fixed in this
  phase)**.

## Known, accepted

- **Low:** one shared server secret covers all server-only functions. Splitting
  it per feature would limit the blast radius of a leak, at the cost of more
  configuration. Rotate it with `npx convex env set` plus `.env.local`.
- **Low:** `style-src` allows `'unsafe-inline'`, because React `style`
  attributes (chart bars, progress widths) can't carry a nonce. Scripts, the
  part that matters for XSS, are nonce-only.
- **Info:** the password component has no delete API, so a deleted account's
  password hash row stays behind. It is unreachable because the username is
  freed and the user row is gone.
