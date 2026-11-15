"use client"

import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { Plus, X } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

type Skill = NonNullable<Doc<"analyses">["skills"]>[number]
type Category = Skill["category"]
type Level = Skill["level"]

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "language", label: "Languages" },
  { value: "framework", label: "Frameworks & libraries" },
  { value: "tool", label: "Tools & databases" },
  { value: "cloud", label: "Cloud" },
  { value: "soft", label: "Soft skills" },
]

const LEVELS: { value: Level; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
]

const selectClass =
  "h-8 rounded-md border border-input bg-card px-2 text-xs transition-[border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 dark:bg-input/30"

const sameSkills = (a: Skill[], b: Skill[]) =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * Lets the user fix the extracted skills: change category or level, remove
 * wrong ones, add missing ones. Saving stores the corrected list, which is
 * what matching uses.
 */
export function SkillEditor({
  analysisId,
  skills,
  aiSkills,
  editedAt,
}: {
  analysisId: Id<"analyses">
  /** The current stored (possibly corrected) list. */
  skills: Skill[]
  /** What the AI originally extracted, for "Reset". */
  aiSkills: Skill[]
  editedAt: number | undefined
}) {
  const updateSkills = useMutation(api.analyses.updateSkills)
  const [draft, setDraft] = useState<Skill[]>(skills)
  // Re-sync the draft when the stored list changes (saved here or elsewhere).
  const [synced, setSynced] = useState(skills)
  if (!sameSkills(synced, skills)) {
    setSynced(skills)
    setDraft(skills)
  }

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const dirty = !sameSkills(draft, skills)

  function update(index: number, patch: Partial<Skill>) {
    setDraft((d) => d.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function add(skill: Skill) {
    const exists = draft.some(
      (s) => s.name.toLowerCase() === skill.name.toLowerCase()
    )
    if (exists) return "You already have this skill"
    setDraft((d) => [...d, skill])
    return null
  }

  async function save() {
    setError(null)
    setSaving(true)
    try {
      await updateSkills({ analysisId, skills: draft })
      setSavedAt(Date.now())
    } catch (e) {
      setError(
        e instanceof ConvexError && typeof e.data === "string"
          ? e.data
          : "Could not save your skills. Please try again."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {CATEGORIES.map((category) => {
        const rows = draft
          .map((skill, index) => ({ skill, index }))
          .filter(({ skill }) => skill.category === category.value)
        if (rows.length === 0) return null
        return (
          <div key={category.value} className="flex flex-col gap-2">
            <h3 className="flex items-baseline gap-2 text-sm font-medium">
              {category.label}
              <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">
                {rows.length}
              </span>
            </h3>
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {rows.map(({ skill, index }) => (
                <SkillRow
                  key={`${skill.name}-${index}`}
                  skill={skill}
                  onChange={(patch) => update(index, patch)}
                  onRemove={() =>
                    setDraft((d) => d.filter((_, i) => i !== index))
                  }
                />
              ))}
            </ul>
          </div>
        )
      })}
      {draft.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No skills yet. Add some below.
        </p>
      )}

      <AddSkill onAdd={add} />

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button disabled={!dirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save skills"}
        </Button>
        <Button
          variant="ghost"
          disabled={!dirty || saving}
          onClick={() => setDraft(skills)}
        >
          Discard changes
        </Button>
        {!sameSkills(draft, aiSkills) && (
          <Button
            variant="link"
            className="px-0"
            onClick={() => setDraft(aiSkills)}
          >
            Reset to AI result
          </Button>
        )}
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {dirty
            ? "Unsaved changes"
            : savedAt
              ? "Saved"
              : editedAt
                ? `Edited by you on ${new Date(editedAt).toLocaleDateString()}`
                : null}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function SkillRow({
  skill,
  onChange,
  onRemove,
}: {
  skill: Skill
  onChange: (patch: Partial<Skill>) => void
  onRemove: () => void
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
        <span className="text-sm font-medium">
          {skill.name}
          {skill.escoUri && (
            <a
              href={skill.escoUri}
              target="_blank"
              rel="noreferrer"
              className="ml-2 rounded-sm px-1 font-mono text-[11px] font-normal text-muted-foreground ring-1 ring-border hover:text-foreground"
              title="Matched in the ESCO skills taxonomy"
            >
              ESCO
            </a>
          )}
        </span>
        <span
          className="truncate text-xs text-muted-foreground"
          title={skill.evidence}
        >
          {skill.evidence}
        </span>
      </div>
      <select
        aria-label={`Category of ${skill.name}`}
        className={selectClass}
        value={skill.category}
        onChange={(e) => onChange({ category: e.target.value as Category })}
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <select
        aria-label={`Level of ${skill.name}`}
        className={selectClass}
        value={skill.level}
        onChange={(e) => onChange({ level: e.target.value as Level })}
      >
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Remove ${skill.name}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </li>
  )
}

function AddSkill({ onAdd }: { onAdd: (skill: Skill) => string | null }) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState<Category>("tool")
  const [level, setLevel] = useState<Level>("intermediate")
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (trimmed.length > 60)
      return setError("Keep skill names under 60 characters")
    const problem = onAdd({
      name: trimmed,
      category,
      level,
      evidence: "Added by you",
    })
    setError(problem)
    if (!problem) setName("")
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="New skill"
          placeholder="Add a skill, e.g. Docker"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          className="max-w-60 flex-1"
        />
        <select
          aria-label="New skill category"
          className={cn(selectClass, "h-9 rounded-lg text-sm")}
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          aria-label="New skill level"
          className={cn(selectClass, "h-9 rounded-lg text-sm")}
          value={level}
          onChange={(e) => setLevel(e.target.value as Level)}
        >
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" disabled={!name.trim()}>
          <Plus data-icon="inline-start" />
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}
