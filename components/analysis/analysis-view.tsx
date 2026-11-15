"use client"

import { useAuthToken } from "@convex-dev/auth/react"
import { useQuery } from "convex/react"
import { useState, type ReactNode } from "react"

import { requestAnalyze } from "@/components/resume/request-parse"
import { LoadingState, WorkingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

import { SkillEditor } from "./skill-editor"

const SENIORITY_LABEL: Record<string, string> = {
  student: "Student",
  intern: "Intern level",
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
}

const JOB_TYPE_LABEL: Record<string, string> = {
  internship: "Internship",
  "full-time": "Full-time",
  remote: "Remote",
}

/** Analysis page for one resume: latest result, skill editor, and history. */
export function AnalysisView({ resumeId }: { resumeId: string }) {
  const resume = useQuery(api.resumes.getMine, { resumeId })
  const latest = useQuery(api.analyses.latestForMyResume, { resumeId })
  const history = useQuery(api.analyses.historyForMyResume, { resumeId })
  const [selectedId, setSelectedId] = useState<Id<"analyses"> | null>(null)

  if (resume === undefined || latest === undefined) {
    return <LoadingState rows={3} label="Loading analysis" />
  }
  if (resume === null) {
    return <p className="text-sm text-muted-foreground">Resume not found</p>
  }

  const viewingOld = selectedId !== null && selectedId !== latest?._id

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-card p-5">
        <div className="flex max-w-xl min-w-0 flex-col gap-1">
          <h2 className="truncate font-mono text-sm">{resume.fileName}</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Skills and career goals extracted by AI. Check the skills and fix
            anything that&apos;s wrong: your corrected list is what we use to
            match jobs.
          </p>
        </div>
        <ReanalyzeButton
          resumeId={resume._id}
          disabled={resume.status !== "parsed" || latest?.status === "running"}
          label={latest ? "Re-analyze" : "Analyze"}
        />
      </div>

      {latest === null ? (
        <p className="text-sm text-muted-foreground">
          This resume hasn&apos;t been analyzed yet
        </p>
      ) : viewingOld ? (
        <OldAnalysis
          analysisId={selectedId}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <AnalysisBody analysis={latest} editable />
      )}

      {history && history.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">History</h2>
          <ul className="flex flex-col divide-y rounded-xl border bg-card text-sm">
            {history.map((h, i) => {
              const active = (selectedId ?? latest?._id) === h._id
              return (
                <li key={h._id}>
                  <button
                    type="button"
                    disabled={h.status !== "done"}
                    onClick={() => setSelectedId(i === 0 ? null : h._id)}
                    className={cn(
                      "flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left disabled:cursor-default",
                      active ? "bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    <span>
                      {new Date(h.createdAt).toLocaleString()}
                      {i === 0 && " · latest"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {h.status === "done"
                        ? `${h.skillCount} skills${h.edited ? " (edited)" : ""} · ${h.provider}/${h.model}`
                        : h.status === "running"
                          ? "running…"
                          : "failed"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function OldAnalysis({
  analysisId,
  onBack,
}: {
  analysisId: Id<"analyses">
  onBack: () => void
}) {
  const analysis = useQuery(api.analyses.getMine, { analysisId })
  if (analysis === undefined)
    return <p className="text-sm text-muted-foreground">Loading…</p>
  if (analysis === null)
    return <p className="text-sm text-muted-foreground">Not found</p>
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <span>
          Viewing an earlier analysis (
          {new Date(analysis.createdAt).toLocaleString()}).
        </span>
        <Button size="sm" variant="outline" onClick={onBack}>
          Back to latest
        </Button>
      </div>
      <AnalysisBody analysis={analysis} editable={false} />
    </div>
  )
}

function ReanalyzeButton({
  resumeId,
  disabled,
  label,
}: {
  resumeId: Id<"resumes">
  disabled: boolean
  label: string
}) {
  const token = useAuthToken()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setError(null)
    setBusy(true)
    const result = await requestAnalyze(resumeId, token)
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" disabled={disabled || busy} onClick={run}>
        {busy ? "Analyzing…" : label}
      </Button>
      {error && (
        <p className="max-w-64 text-right text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}

function AnalysisBody({
  analysis,
  editable,
}: {
  analysis: Doc<"analyses">
  editable: boolean
}) {
  if (analysis.status === "running") {
    return (
      <WorkingState>
        Analyzing your resume. This takes about 10 to 30 seconds
      </WorkingState>
    )
  }
  if (analysis.status === "failed" || !analysis.result) {
    return (
      <p className="text-sm text-destructive">
        {analysis.error ?? "This analysis failed."} Try re-analyzing.
      </p>
    )
  }

  const r = analysis.result
  const skills = analysis.skills ?? r.skills

  return (
    <div className="flex flex-col gap-8">
      <Section title="Summary">
        <p className="text-sm leading-6">{r.summary}</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip strong>{SENIORITY_LABEL[r.seniority] ?? r.seniority}</Chip>
          {r.inferredRoles.map((role) => (
            <Chip key={role}>{role}</Chip>
          ))}
        </div>
      </Section>

      <Section
        title={`Skills (${skills.length})`}
        description={
          editable
            ? "Remove anything wrong, adjust levels, and add what's missing."
            : undefined
        }
      >
        {editable ? (
          <SkillEditor
            analysisId={analysis._id}
            skills={skills}
            aiSkills={r.skills}
            editedAt={analysis.skillsEditedAt}
          />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <Chip key={s.name}>
                {s.name} · {s.level}
              </Chip>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Career goals"
        description="From your resume, combined with the preferences you saved."
      >
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <Term label="Target roles" items={r.careerGoals.targetRoles} />
          <Term label="Industries" items={r.careerGoals.industries} />
          <Term
            label="Job types"
            items={r.careerGoals.jobTypes.map((t) => JOB_TYPE_LABEL[t] ?? t)}
          />
          <Term label="Locations" items={r.careerGoals.locations} />
          {r.careerGoals.statedGoal && (
            <>
              <dt className="text-muted-foreground">Stated goal</dt>
              <dd>{r.careerGoals.statedGoal}</dd>
            </>
          )}
        </dl>
      </Section>

      <div className="grid gap-8 sm:grid-cols-2">
        <Section title="Strengths">
          <Bullets items={r.strengths} />
        </Section>
        <Section title="Gaps to work on">
          <Bullets items={r.gaps} />
        </Section>
      </div>

      {r.experience.length > 0 && (
        <Section title="Experience">
          <ul className="flex flex-col gap-4">
            {r.experience.map((e, i) => (
              <li key={i} className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {e.title} · {e.organization}
                </span>
                {(e.startDate || e.endDate) && (
                  <span className="text-xs text-muted-foreground">
                    {[e.startDate, e.endDate].filter(Boolean).join(" – ")}
                  </span>
                )}
                <Bullets items={e.highlights} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.projects.length > 0 && (
        <Section title="Projects">
          <ul className="flex flex-col gap-4">
            {r.projects.map((p, i) => (
              <li key={i} className="flex flex-col gap-1">
                <span className="text-sm font-medium">{p.name}</span>
                {p.description && <p className="text-sm">{p.description}</p>}
                {p.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.technologies.map((t) => (
                      <Chip key={t}>{t}</Chip>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.education.length > 0 && (
        <Section title="Education">
          <ul className="flex flex-col gap-2 text-sm">
            {r.education.map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.institution}</span>
                {[e.degree, e.field].filter(Boolean).length > 0 &&
                  ` · ${[e.degree, e.field].filter(Boolean).join(", ")}`}
                {e.graduationYear && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {e.graduationYear}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="text-xs text-muted-foreground">
        Analyzed {new Date(analysis.createdAt).toLocaleString()} with{" "}
        {analysis.provider}/{analysis.model} · prompt {analysis.promptVersion}
      </p>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

function Chip({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs",
        strong
          ? "bg-foreground font-medium text-background"
          : "bg-muted text-foreground"
      )}
    >
      {children}
    </span>
  )
}

function Term({ label, items }: { label: string; items: string[] }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{items.length > 0 ? items.join(", ") : "—"}</dd>
    </>
  )
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}
