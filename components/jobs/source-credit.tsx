import { SOURCE_CREDITS } from "@/lib/jobs/credits"
import type { JobSource } from "@/lib/jobs/types"

/** "via Remotive" with a link back: some sources require this attribution. */
export function SourceCredit({ source }: { source: JobSource }) {
  const credit = SOURCE_CREDITS[source]
  return (
    <span className="text-xs text-muted-foreground">
      via{" "}
      <a
        href={credit.url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        {credit.name}
      </a>
    </span>
  )
}
