# Phase 6 — Dashboard & UX

**Status: built (2026-11-15); the Lighthouse ≥ 90 check and a manual
mobile/desktop pass are still to do.** Shared `AppShell` (nav, theme toggle,
skip link), landing page with privacy note, `/dashboard` (getting-started
checklist, profile summary, Recharts skills-by-category chart, strengths/gaps,
top 5 matches), `/jobs` filters (type, work mode, location, posted date) with a
detail drawer (match reason, missing skills, feedback), `/tracker` (saved /
applied / hidden), `/settings` (theme, new resume, delete account). Every async
view has loading (skeleton), empty and error states; `app/error.tsx` and
`app/not-found.tsx` catch the rest. Account deletion removes app data, revokes
sessions and frees the username; Convex Auth v2's password component has no
delete API, so the password hash row remains (unreachable).

**Goal:** a clean, responsive product built on the data from Phases 1–5.

## Screens
- Landing page: what the product does, plus a privacy note about AI processing
- Onboarding: upload a resume, review the extracted skills, set goals
- Dashboard: profile summary, strengths and skills chart, top matches
- Job list: filters (type, remote, location, posted date) and a detail drawer
  with the match explanation and missing skills
- Tracker for saved jobs and applications
- Settings: upload a new resume, delete the account and all data

## Notes
- Build with shadcn/ui and support dark mode (next-themes is already installed)
- Give every async view loading, empty and error states
- Accessibility: keyboard navigation, labelled inputs, colour contrast checks
- If charts are needed, use Recharts (MIT)

## Exit criteria
- The full flow works on mobile and desktop, and the Lighthouse accessibility score is at least 90
