# Phase 4 — Job & Internship Ingestion

**Status: done (2026-11-15).** 762 active, de-duplicated listings (Arbeitnow
660, Himalayas 56, Remote OK 37, Remotive 9); per-source call counts are logged
in `jobSyncRuns`. Adzuna and Jooble skip themselves until their keys are set.
The daily cron runs once `JOBS_SYNC_URL` / `JOBS_SYNC_SECRET` are set on the
deployed Convex app (a cloud deployment can't reach localhost).

**Goal:** a growing pool of current job and internship listings in Convex, without duplicates.

## Tasks
1. `lib/jobs/types.ts` defines one shared `Job` shape: source, externalId,
   title, company, location, remote, type, level, description, skills[],
   salary?, url, postedAt.
2. One adapter per source in `lib/jobs/sources/`: `adzuna.ts`, `remotive.ts`,
   `arbeitnow.ts`, `jooble.ts`, `himalayas.ts` (see `docs/resources.md`).
3. A sync route, `app/api/jobs/sync/route.ts`, protected by a secret header. A
   **Convex cron** calls it over HTTP, which keeps AI and external API calls in
   Next.js and Convex as the database only. A scheduled GitHub Action would
   also work.
4. Remove duplicates by `(source, externalId)` and by a hash of title and
   company. Expire listings older than 30 days or no longer returned by the
   source.
5. Set level and type with keyword rules first (intern, trainee, graduate).
   Send unclear listings to a cheap Groq call. Extract skills from each
   description.
6. Show the credit each source requires (Remotive, RemoteOK) wherever its jobs
   appear.
7. Schema: a `jobs` table with indexes `by_source_and_externalId` and
   `by_type_and_postedAt`, plus a search index on title and description.

## Env
`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRY`, `JOOBLE_API_KEY`, `JOBS_SYNC_SECRET`

## Exit criteria
- At least 500 active listings, with no duplicates, refreshed daily
- Every source stays within its free quota (log the call counts)
