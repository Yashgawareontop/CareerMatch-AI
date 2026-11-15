import "server-only"

import type { SourceAdapter } from "../types"

import { adzuna } from "./adzuna"
import { arbeitnow } from "./arbeitnow"
import { himalayas } from "./himalayas"
import { jooble } from "./jooble"
import { remoteok } from "./remoteok"
import { remotive } from "./remotive"

/** Order matters: when two sources list the same job, the earlier one wins. */
export const SOURCES: SourceAdapter[] = [
  adzuna,
  jooble,
  remotive,
  himalayas,
  remoteok,
  arbeitnow,
]
