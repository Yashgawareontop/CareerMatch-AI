/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js"
import type * as aiCalls from "../aiCalls.js"
import type * as analyses from "../analyses.js"
import type * as auth from "../auth.js"
import type * as crons from "../crons.js"
import type * as jobs from "../jobs.js"
import type * as jobsCron from "../jobsCron.js"
import type * as matches from "../matches.js"
import type * as profiles from "../profiles.js"
import type * as rateLimits from "../rateLimits.js"
import type * as resumeLimits from "../resumeLimits.js"
import type * as resumes from "../resumes.js"
import type * as serverAuth from "../serverAuth.js"
import type * as skillCache from "../skillCache.js"
import type * as skillNames from "../skillNames.js"
import type * as usage from "../usage.js"
import type * as users from "../users.js"

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server"

declare const fullApi: ApiFromModules<{
  account: typeof account
  aiCalls: typeof aiCalls
  analyses: typeof analyses
  auth: typeof auth
  crons: typeof crons
  jobs: typeof jobs
  jobsCron: typeof jobsCron
  matches: typeof matches
  profiles: typeof profiles
  rateLimits: typeof rateLimits
  resumeLimits: typeof resumeLimits
  resumes: typeof resumes
  serverAuth: typeof serverAuth
  skillCache: typeof skillCache
  skillNames: typeof skillNames
  usage: typeof usage
  users: typeof users
}>

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">
  authUsername: import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">
}
