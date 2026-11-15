import { cn } from "@/lib/utils"

export const pct = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 100)

/**
 * The match score as a mono figure over a thin fit bar. Used wherever a
 * match is shown, so the number always reads the same way.
 */
export function MatchScore({
  score,
  size = "default",
  className,
}: {
  score: number
  size?: "default" | "sm"
  className?: string
}) {
  const value = pct(score)
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-end gap-1.5",
        size === "sm" ? "w-12" : "w-16",
        className
      )}
    >
      <span
        className={cn(
          "font-mono leading-none tabular-nums",
          size === "sm" ? "text-sm" : "text-xl"
        )}
      >
        {value}
        <span className="text-muted-foreground">%</span>
      </span>
      <span
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${value}% match`}
      >
        <span
          className="block h-full rounded-full bg-brand"
          style={{ width: `${value}%` }}
        />
      </span>
    </div>
  )
}

/** Matched skills marked with the highlighter, missing ones in plain text. */
export function SkillWords({
  matched,
  missing,
  limit = 8,
}: {
  matched: string[]
  missing: string[]
  limit?: number
}) {
  if (matched.length === 0 && missing.length === 0) return null
  return (
    <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[5.5rem_1fr]">
      {matched.length > 0 && (
        <>
          <dt className="text-muted-foreground">You have</dt>
          <dd className="leading-6">
            {matched.slice(0, limit).map((s, i) => (
              <span key={s}>
                <span className="highlight">{s}</span>
                {i < Math.min(matched.length, limit) - 1 && ", "}
              </span>
            ))}
            {matched.length > limit && (
              <span className="text-muted-foreground">
                {" "}
                and {matched.length - limit} more
              </span>
            )}
          </dd>
        </>
      )}
      {missing.length > 0 && (
        <>
          <dt className="text-muted-foreground">To learn</dt>
          <dd className="leading-6">{missing.join(", ")}</dd>
        </>
      )}
    </dl>
  )
}
