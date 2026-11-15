"use client"

import type { Infer } from "convex/values"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { skillValidator } from "@/convex/schema"

type Skill = Infer<typeof skillValidator>

const CATEGORIES: { key: Skill["category"]; label: string }[] = [
  { key: "language", label: "Languages" },
  { key: "framework", label: "Frameworks" },
  { key: "tool", label: "Tools" },
  { key: "cloud", label: "Cloud" },
  { key: "soft", label: "Soft skills" },
]

// Levels stack left to right in neutral steps; only "expert" takes the
// accent, so the strongest skills are what the eye lands on.
const LEVELS: { key: Skill["level"]; label: string; color: string }[] = [
  { key: "beginner", label: "Beginner", color: "var(--chart-1)" },
  { key: "intermediate", label: "Intermediate", color: "var(--chart-2)" },
  { key: "advanced", label: "Advanced", color: "var(--chart-3)" },
  { key: "expert", label: "Expert", color: "var(--chart-5)" },
]

const MONO = "var(--font-mono), ui-monospace, monospace"

/** Skills per category, stacked by level. */
export function SkillsChart({ skills }: { skills: Skill[] }) {
  const data = CATEGORIES.map((c) => {
    const row: Record<string, string | number> = { category: c.label }
    for (const l of LEVELS) {
      row[l.key] = skills.filter(
        (s) => s.category === c.key && s.level === l.key
      ).length
    }
    return row
  }).filter((row) => LEVELS.some((l) => (row[l.key] as number) > 0))

  const summary = data
    .map((row) => {
      const total = LEVELS.reduce((n, l) => n + (row[l.key] as number), 0)
      return `${row.category}: ${total}`
    })
    .join(", ")

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No skills yet</p>
  }

  return (
    <figure className="flex flex-col gap-4">
      <div
        style={{ height: data.length * 44 + 32 }}
        className="w-full"
        aria-hidden
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
            barCategoryGap={12}
          >
            <CartesianGrid
              horizontal={false}
              stroke="var(--border)"
              strokeDasharray="2 4"
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{
                fill: "var(--muted-foreground)",
                fontSize: 11,
                fontFamily: MONO,
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="category"
              width={84}
              tick={{ fill: "var(--muted-foreground)", fontSize: 13 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
                fontSize: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              }}
            />
            {LEVELS.map((l) => (
              <Bar
                key={l.key}
                dataKey={l.key}
                name={l.label}
                stackId="level"
                fill={l.color}
                stroke="var(--card)"
                strokeWidth={1}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {LEVELS.map((l) => (
          <li key={l.key} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-[2px]"
              style={{ background: l.color }}
              aria-hidden
            />
            {l.label}
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">Skills by category. {summary}</figcaption>
    </figure>
  )
}
