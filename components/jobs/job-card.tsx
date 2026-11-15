import type { Doc } from "@/convex/_generated/dataModel"

import { SourceCredit } from "./source-credit"

export const LEVEL_LABEL: Record<Doc<"jobs">["level"], string | null> = {
  intern: "Intern",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  unknown: null,
}

export function formatSalary(salary: Doc<"jobs">["salary"]) {
  if (!salary) return null
  if (salary.text) return salary.text
  const fmt = (n: number) =>
    new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n)
  const range = [salary.min, salary.max]
    .filter((n): n is number => n !== undefined)
    .map(fmt)
    .join("–")
  return range ? `${salary.currency ?? ""} ${range}`.trim() : null
}

export function formatPosted(postedAt: number) {
  return new Date(postedAt).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  })
}

/** Type, level, remote and salary as quiet tags. */
export function JobTags({ job }: { job: Doc<"jobs"> }) {
  const salary = formatSalary(job.salary)
  const level = LEVEL_LABEL[job.level]
  const tags = [job.type, level, job.remote ? "Remote" : null].filter(
    (t): t is string => !!t
  )
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-block rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground first-letter:uppercase"
        >
          {tag}
        </span>
      ))}
      {salary && (
        <span className="px-1 font-mono text-muted-foreground tabular-nums">
          {salary}
        </span>
      )}
    </div>
  )
}

/**
 * A listing summary. With `onOpen`, the title opens the detail drawer;
 * otherwise it links to the listing. `children` go below the tags.
 */
export function JobCard({
  job,
  onOpen,
  aside,
  children,
}: {
  job: Doc<"jobs">
  onOpen?: () => void
  /** Shown top right instead of the posted date, like a match score. */
  aside?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <article
      data-reveal
      className="flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-colors has-[button.job-title:hover]:border-foreground/15"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              className="job-title text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
            >
              {job.title}
            </button>
          ) : (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline-offset-4 hover:underline"
            >
              {job.title}
            </a>
          )}
          <p className="text-sm text-muted-foreground">
            {job.company} · {job.location}
          </p>
        </div>
        {aside ?? (
          <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
            {formatPosted(job.postedAt)}
          </span>
        )}
      </div>

      <JobTags job={job} />

      {children}

      {!children && job.skills.length > 0 && (
        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {job.skills.slice(0, 10).join(" · ")}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
        <SourceCredit source={job.source} />
        {aside && (
          <span className="font-mono tabular-nums">
            {formatPosted(job.postedAt)}
          </span>
        )}
      </div>
    </article>
  )
}
