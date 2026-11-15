import {
  FileTextIcon,
  ListOrderedIcon,
  ScanTextIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react"

import { MatchScore } from "@/components/matches/match-score"
import { SOURCE_CREDITS } from "@/lib/jobs/credits"
import { cn } from "@/lib/utils"

const SOURCE_COUNT = Object.keys(SOURCE_CREDITS).length

/**
 * The pipeline from one PDF to a ranked shortlist, as four connected
 * stages. A dot travels the connector to show the direction of the work.
 */
export function Flow() {
  return (
    <div className="flex flex-col gap-6">
      <Rail />
      <ol className="grid gap-4 lg:grid-cols-4 lg:gap-6">
        <Stage n={1} icon={FileTextIcon} title="Your resume" note="PDF or DOCX">
          <div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-3">
            <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>resume.pdf</span>
              <span>2 pages</span>
            </div>
            <span className="h-1.5 w-11/12 rounded-full bg-muted" />
            <span className="h-1.5 w-full rounded-full bg-mark" />
            <span className="h-1.5 w-4/5 rounded-full bg-muted" />
            <span className="h-1.5 w-3/4 rounded-full bg-mark" />
            <span className="h-1.5 w-2/3 rounded-full bg-muted" />
          </div>
        </Stage>

        <Stage
          n={2}
          icon={ScanTextIcon}
          title="Skills and goals"
          note="Each with the line it came from"
        >
          <ul className="flex flex-col gap-1.5 text-sm">
            {[
              ["React", "Advanced"],
              ["TypeScript", "Advanced"],
              ["PostgreSQL", "Intermediate"],
              ["Docker", "Beginner"],
            ].map(([name, level]) => (
              <li
                key={name}
                className="flex items-center justify-between gap-2 rounded-md border bg-background/60 px-2.5 py-1.5"
              >
                <span className="highlight">{name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {level}
                </span>
              </li>
            ))}
          </ul>
        </Stage>

        <Stage
          n={3}
          icon={SearchIcon}
          title="Current listings"
          note={`${SOURCE_COUNT} public job boards, refreshed daily`}
        >
          <div className="flex flex-col gap-1.5">
            {["Frontend Intern", "Data Analyst Intern", "Junior Developer"].map(
              (t, i) => (
                <div
                  key={t}
                  className={cn(
                    "flex items-center gap-2 rounded-md border bg-background/60 px-2.5 py-1.5 text-sm",
                    i === 0 && "border-foreground/15"
                  )}
                >
                  <span className="size-4 shrink-0 rounded-sm bg-muted" />
                  <span className="truncate">{t}</span>
                </div>
              )
            )}
            <p className="pt-1 font-mono text-[11px] text-muted-foreground">
              compared by meaning, skills and fit
            </p>
          </div>
        </Stage>

        <Stage
          n={4}
          icon={ListOrderedIcon}
          title="Your ranked shortlist"
          note="With the reason each one fits"
          lead
        >
          <ol className="flex flex-col gap-2">
            {[
              ["Frontend Engineering Intern", 0.87],
              ["Full-stack Developer Intern", 0.79],
              ["Junior Web Developer", 0.71],
            ].map(([t, s], i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="w-3 font-mono text-xs text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{t}</span>
                <MatchScore score={s as number} size="sm" />
              </li>
            ))}
          </ol>
        </Stage>
      </ol>
    </div>
  )
}

function Stage({
  n,
  icon: Icon,
  title,
  note,
  lead = false,
  children,
}: {
  n: number
  icon: LucideIcon
  title: string
  note: string
  lead?: boolean
  children: React.ReactNode
}) {
  return (
    <li
      data-reveal
      style={{ "--reveal-i": n - 1 } as React.CSSProperties}
      className={cn(
        "relative z-10 flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-foreground/15",
        lead &&
          "border-foreground/15 shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border bg-background",
            lead && "border-transparent bg-foreground text-background"
          )}
        >
          <Icon className="size-4" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-[11px] text-muted-foreground">
            Step {n}
          </span>
          <h3 className="font-medium">{title}</h3>
        </div>
      </div>
      {children}
      <p className="mt-auto text-xs text-muted-foreground">{note}</p>
    </li>
  )
}

const RAIL = ["Read", "Extract", "Compare", "Rank"]

/**
 * A rail above the stages: four nodes on a dashed line, with one dot
 * travelling from the resume to the shortlist. Desktop only.
 */
function Rail() {
  return (
    <div aria-hidden className="relative hidden grid-cols-4 gap-6 lg:grid">
      <div className="absolute top-[11px] right-[calc(25%-30px)] left-[12px] h-px bg-[repeating-linear-gradient(90deg,var(--input)_0_6px,transparent_6px_12px)]">
        <span className="absolute inset-0 motion-safe:animate-[flow-x_5s_cubic-bezier(0.65,0,0.35,1)_infinite]">
          <span className="absolute top-1/2 left-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-4 ring-background" />
        </span>
      </div>
      {RAIL.map((label, i) => (
        <div key={label} className="relative flex items-center gap-3">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full border bg-background font-mono text-[11px] tabular-nums",
              i === RAIL.length - 1 &&
                "border-transparent bg-foreground text-background"
            )}
          >
            {i + 1}
          </span>
          <span className="bg-background pr-2 text-sm text-muted-foreground">
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
