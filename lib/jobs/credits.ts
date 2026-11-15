import type { JobSource } from "./types"

/**
 * Display name and link for each source, shown wherever its listings appear.
 * `required`: the source's terms ask for visible attribution (Remotive,
 * Remote OK). Client-safe: no server imports.
 */
export const SOURCE_CREDITS: Record<
  JobSource,
  { name: string; url: string; required: boolean }
> = {
  adzuna: { name: "Adzuna", url: "https://www.adzuna.com", required: false },
  jooble: { name: "Jooble", url: "https://jooble.org", required: false },
  remotive: { name: "Remotive", url: "https://remotive.com", required: true },
  himalayas: {
    name: "Himalayas",
    url: "https://himalayas.app",
    required: false,
  },
  remoteok: { name: "Remote OK", url: "https://remoteok.com", required: true },
  arbeitnow: {
    name: "Arbeitnow",
    url: "https://www.arbeitnow.com",
    required: false,
  },
}
