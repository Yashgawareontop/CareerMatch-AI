// Bullet glyphs seen in exported resumes, incl. Word's Symbol-font bullet
// (U+F0B7) and other private-use characters some PDFs emit for bullets.
// Written as escapes so no invisible characters live in the source.
const BULLET_CHARS =
  "\u2022\u25CF\u25CB\u25E6\u25AA\u25AB\u25A0\u25A1\u25C6\u25C7" + // • ● ○ ◦ ▪ ▫ ■ □ ◆ ◇
  "\u25BA\u25B6\u25B8\u2023\u2219\u00B7\u2043\u2756\u27A2\u27A4" + // ► ▶ ▸ ‣ ∙ · ⁃ ❖ ➢ ➤
  "\u2713\u2714\u2605\u2610" + // ✓ ✔ ★ ☐
  "\uF0B7\uF0A7\uF076\uF0D8\uF0FC" // private-use bullets (Symbol/Wingdings)
const LEADING_BULLET = new RegExp(String.raw`^[${BULLET_CHARS}*]+\s*`, "u")
// Only "real" bullets split a line; "·" is often a separator ("a@b.com · Pune").
const INLINE_BULLET_CHARS = "\u2022\u25CF\u25AA\u25A0\uF0B7\uF0A7" // • ● ▪ ■ + private-use
const INLINE_BULLET = new RegExp(
  String.raw`\s+[${INLINE_BULLET_CHARS}]\s+`,
  "u"
)

/**
 * Normalizes text extracted from a resume: line endings, odd whitespace,
 * bullet glyphs (→ "- "), and runs of blank lines.
 */
export function cleanResumeText(input: string): string {
  const text = input
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n")
    // zero-width chars and soft hyphens
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
    // control chars other than \t and \n
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")

  const lines = text.split("\n").flatMap((raw) => {
    const line = raw
      .replace(/[\t\u00A0\u2000-\u200A\u202F\u205F\u3000 ]+/g, " ")
      .trim()
    // Several bullets on one line ("Python • SQL • Git"): one item per line.
    const items = line
      .replace(LEADING_BULLET, "")
      .split(INLINE_BULLET)
      .filter(Boolean)
    if (items.length > 1) return items.map((item) => `- ${item}`)
    if (LEADING_BULLET.test(line)) {
      const rest = line.replace(LEADING_BULLET, "")
      return rest ? [`- ${rest}`] : []
    }
    // "-Item" / "– Item" style bullets
    return [line.replace(/^[-\u2013\u2014]\s*(?=\S)/, "- ")]
  })

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Letters and digits in the text: a rough measure of "real" content. */
export function contentLength(text: string): number {
  return text.match(/[\p{L}\p{N}]/gu)?.length ?? 0
}
