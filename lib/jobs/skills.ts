import { aliasFor, skillSpellings } from "@/convex/skillNames"

/**
 * Skill extraction from listings, using the same alias map as resume analysis
 * so job skills and resume skills share canonical names (needed for matching).
 * No AI: plain word-boundary matching over the title and description, plus
 * the source's own tags.
 */

const MAX_JOB_SKILLS = 30

// Soft skills appear in nearly every listing, so they carry no signal here.
const SKIP_CANONICAL = new Set([
  "Communication",
  "Teamwork",
  "Leadership",
  "Problem Solving",
  "Time Management",
  "Critical Thinking",
])

// Spellings that are ordinary words or too short to match in free text
// ("go", "rest", "node", "excel at"…). They still match as source tags.
const SKIP_SPELLING = new Set([
  "c",
  "r",
  "go",
  "py",
  "ts",
  "ml",
  "rest",
  "node",
  "spark",
  "express",
  "swift",
  "rust",
  "dart",
  "excel",
  "torch",
  "rtk",
  "ror",
  "oops",
  "oop",
  "rails",
  "algorithms",
  "data structures",
  "vue",
  "spring",
  "flutter",
  "linux",
])

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const MATCHERS: { needle: string; re: RegExp; canonical: string }[] =
  skillSpellings()
    .filter(
      ([spelling, canonical]) =>
        !SKIP_CANONICAL.has(canonical) &&
        !SKIP_SPELLING.has(spelling.toLowerCase())
    )
    .map(([spelling, canonical]) => {
      const needle = spelling.toLowerCase()
      return {
        needle,
        // Not inside a longer word; "C++"/"C#"/".NET" keep their symbols.
        re: new RegExp(`(?<![\\w+#])${escape(needle)}(?![\\w+#])`),
        canonical,
      }
    })

// Re-allow the few skipped ones that are unambiguous in their proper casing.
const CASED: { re: RegExp; canonical: string }[] = [
  {
    re: /\bGolang\b|\bGo (?:developer|engineer|programming)\b/,
    canonical: "Go",
  },
  { re: /\bRust\b/, canonical: "Rust" },
  { re: /\bSwift(?:UI)?\b/, canonical: "Swift" },
  { re: /\bNode\b/, canonical: "Node.js" },
  { re: /\bFlutter\b/, canonical: "Flutter" },
  { re: /\bLinux\b/, canonical: "Linux" },
  { re: /\bVue\b/, canonical: "Vue.js" },
  { re: /\bExcel\b/, canonical: "Microsoft Excel" },
  { re: /\bREST(?:ful)?\b/, canonical: "REST APIs" },
]

export function extractSkills(
  title: string,
  description: string,
  tags: string[] = []
): string[] {
  const found = new Set<string>()
  for (const tag of tags) {
    const canonical = aliasFor(tag)
    if (canonical && !SKIP_CANONICAL.has(canonical)) found.add(canonical)
  }
  const text = `${title}\n${description}`
  const lower = text.toLowerCase()
  for (const m of MATCHERS) {
    if (found.has(m.canonical) || !lower.includes(m.needle)) continue
    if (m.re.test(lower)) found.add(m.canonical)
  }
  for (const c of CASED) {
    if (!found.has(c.canonical) && c.re.test(text)) found.add(c.canonical)
  }
  return [...found].slice(0, MAX_JOB_SKILLS)
}
