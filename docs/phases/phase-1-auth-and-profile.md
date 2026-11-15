# Phase 1 — Auth & User Profile

**Goal:** users can sign up, sign in, and save basic career preferences.

## Tasks
1. Pick an auth option: **Convex Auth** (`@convex-dev/auth`, open source, data
   stays in Convex) or the Clerk free tier. Add `convex/auth.config.ts`.
2. Replace `ConvexProvider` with `ConvexProviderWithAuth` (or the auth
   library's own provider).
3. Schema: `users` and `profiles` tables. Profile fields: name, education,
   graduation year, location, preferred roles, job type
   (internship/full-time/remote), target industries.
4. Mutations and queries get the user from `ctx.auth.getUserIdentity()` and
   **never** take a user ID as an argument.
5. Protect routes with `proxy.ts`. Next 16 renamed middleware to proxy; read
   `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
6. Pages: sign-in, sign-up, and an onboarding/preferences form.

## Dependencies
`@convex-dev/auth` (or `@clerk/nextjs`), `react-hook-form`, `@hookform/resolvers`

## Exit criteria
- A user can sign up, sign out, and sign back in
- Preferences are saved in Convex, and only their owner can read them

## Status: done

What was built (and how it differs from the plan above):

- **Auth:** Convex Auth **v2** (`@convex-dev/auth@2`) with the
  **username + password** method. v2 is component-based: `convex/convex.config.ts`
  mounts `auth`, `authPassword` and `authUsername`. Tokens are signed with the
  deployment's own key, so there is no `JWT_PRIVATE_KEY`/`JWKS` to set.
  Email + password was skipped for now because v2 requires email verification
  through Resend (API key and a verified sending domain). It can be added later
  next to username/password.
- **Backend:** `convex/auth.ts` (session + sign-in functions),
  `convex/auth.config.ts`, `convex/schema.ts` (`users`, `profiles`),
  `convex/users.ts` (`createUser` callback, `viewer`), `convex/profiles.ts`
  (`getMine`, `upsertMine`). The user always comes from `getAuthUserId(ctx)`.
  A profile has one `jobTypes` array, so a user can pick several job types.
- **Next.js:** `lib/auth/server.ts` sets up the SSR integration. The refresh
  token lives only in an httpOnly cookie, handled by the `app/auth/{signin,refresh,signout}`
  routes. Any new function that mints a session must be added to the `signIn`
  allowlist there. `app/layout.tsx` uses `ConvexAuthNextjsServerProvider`.
  `proxy.ts` refreshes the session and redirects: `/onboarding` needs sign-in,
  and `/sign-in` and `/sign-up` send signed-in users on to `/onboarding`.
- **Pages:** `/sign-in`, `/sign-up`, `/onboarding` (preferences form,
  react-hook-form + zod).
