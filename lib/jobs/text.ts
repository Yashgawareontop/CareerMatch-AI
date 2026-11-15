const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
}

export const MAX_DESCRIPTION = 6000

/** HTML → plain text, whitespace collapsed, truncated to MAX_DESCRIPTION. */
export function htmlToText(
  html: string | null | undefined,
  max = MAX_DESCRIPTION
) {
  if (!html) return ""
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e: string) => {
      if (e.startsWith("#x"))
        return String.fromCodePoint(parseInt(e.slice(2), 16))
      if (e.startsWith("#") && e !== "#39")
        return String.fromCodePoint(Number(e.slice(1)))
      return ENTITIES[e.toLowerCase()] ?? m
    })
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
}

/** Short single-line text field (title, company, location). */
export function clean(value: unknown, max = 200): string {
  if (typeof value !== "string") return ""
  return htmlToText(value, max).replace(/\s+/g, " ").trim()
}

/** Seconds / ms / ISO string → ms timestamp, or null. */
export function toTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value
  }
  if (typeof value === "string" && value) {
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? null : ms
  }
  return null
}

const REMOTE = /\b(remote|work from home|wfh|home[- ]office|anywhere)\b/i
export const looksRemote = (...texts: string[]) =>
  texts.some((t) => REMOTE.test(t))

export function positiveNumber(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined
}
