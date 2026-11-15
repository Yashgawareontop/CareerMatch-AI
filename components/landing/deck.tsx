import { MatchScore, SkillWords } from "@/components/matches/match-score"
import { cn } from "@/lib/utils"

/** Sample matches for the landing page. Names are illustrative. */
const DECK = [
  {
    title: "Frontend Engineering Intern",
    company: "Fieldnote",
    where: "Remote",
    score: 0.87,
    reason:
      "Your course planner is the same stack they ship: React, TypeScript and a Postgres-backed API",
    matched: ["React", "TypeScript", "PostgreSQL"],
    missing: ["Playwright"],
    parts: { meaning: 0.84, skills: 0.75, fit: 1 },
  },
  {
    title: "Full-stack Developer Intern",
    company: "Larkspur Health",
    where: "Pune, hybrid",
    score: 0.79,
  },
  {
    title: "Junior Web Developer",
    company: "Tideline",
    where: "Remote",
    score: 0.71,
  },
]

/**
 * Three ranked matches stacked in real 3D space: the deck leans back, the
 * top card sits closest, and it rises a little on hover.
 */
export function MatchDeck() {
  const [top, ...rest] = DECK
  return (
    <div className="[perspective:1600px]" aria-hidden>
      <div className="group relative mx-auto h-[420px] w-full max-w-[440px] [transform:rotateX(10deg)_rotateY(-12deg)] [transform-style:preserve-3d] sm:h-[400px]">
        {rest
          .slice()
          .reverse()
          .map((m, i) => {
            const depth = rest.length - i // 2 = farthest
            return (
              <div
                key={m.title}
                className="absolute inset-x-0 top-0 rounded-2xl border bg-card p-5 shadow-[0_12px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
                style={{
                  transform: `translate3d(0, ${depth * -64}px, ${depth * -40}px) scale(${1 - depth * 0.03})`,
                  opacity: 1 - depth * 0.08,
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {m.company} · {m.where}
                    </p>
                  </div>
                  <MatchScore score={m.score} />
                </div>
              </div>
            )
          })}

        <div
          className={cn(
            "absolute inset-x-0 top-0 flex flex-col gap-4 rounded-2xl border bg-card p-5",
            "shadow-[0_24px_48px_rgba(0,0,0,0.12)] dark:bg-popover dark:shadow-[0_24px_48px_rgba(0,0,0,0.5)]",
            "[transform:translateZ(24px)] transition-transform duration-300 ease-out group-hover:[transform:translateZ(48px)]"
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[11px] text-muted-foreground">
                #1 for you
              </span>
              <p className="font-medium">{top.title}</p>
              <p className="text-sm text-muted-foreground">
                {top.company} · {top.where}
              </p>
            </div>
            <MatchScore score={top.score} />
          </div>
          <p className="text-sm leading-6">{top.reason}</p>
          <SkillWords matched={top.matched ?? []} missing={top.missing ?? []} />
          <div className="grid grid-cols-3 gap-3 border-t pt-4">
            {Object.entries(top.parts ?? {}).map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1.5">
                <span className="flex items-baseline justify-between text-xs text-muted-foreground">
                  <span className="capitalize">{k}</span>
                  <span className="font-mono tabular-nums">
                    {Math.round(v * 100)}
                  </span>
                </span>
                <span className="h-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-foreground/70"
                    style={{ width: `${v * 100}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const SKILL_ROWS = [
  {
    name: "React",
    level: "Advanced",
    evidence: "“Built a course planner in React and TypeScript”",
  },
  {
    name: "PostgreSQL",
    level: "Intermediate",
    evidence: "“Designed the PostgreSQL schema and a REST API”",
  },
  {
    name: "Docker",
    level: "Beginner",
    evidence: "“deployed with Docker”",
    edited: true,
  },
  {
    name: "Figma",
    level: "Intermediate",
    evidence: "Added by you",
    added: true,
  },
]

/** A still of the skill editor: evidence per skill, with the user's fixes. */
export function SkillCheck() {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-[0_12px_32px_rgba(0,0,0,0.06)] sm:p-6 dark:shadow-none"
      aria-hidden
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">
          Frameworks and tools{" "}
          <span className="font-mono text-xs font-normal text-muted-foreground">
            4
          </span>
        </p>
        <span className="text-xs text-muted-foreground">Unsaved changes</span>
      </div>
      <ul className="flex flex-col divide-y rounded-xl border">
        {SKILL_ROWS.map((s) => (
          <li
            key={s.name}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5",
              s.added && "bg-mark/30"
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium">{s.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {s.evidence}
              </span>
            </div>
            <span
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs",
                s.edited && "border-brand/50 text-foreground"
              )}
            >
              {s.level}
              <svg viewBox="0 0 12 12" className="size-3 text-muted-foreground">
                <path
                  d="M3 4.5 6 7.5 9 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 pt-1">
        <span className="flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground">
          Save skills
        </span>
        <span className="flex h-9 items-center px-3 text-sm text-muted-foreground">
          Reset to AI result
        </span>
      </div>
    </div>
  )
}
