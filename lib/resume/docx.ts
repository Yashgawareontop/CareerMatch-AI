import JSZip from "jszip"
import mammoth from "mammoth"

/**
 * DOCX → text. Uses mammoth's HTML output (not its raw text) because the HTML
 * keeps list items and line breaks, and adds page headers/footers, which
 * mammoth skips but resumes often use for contact details.
 */
export async function docxToText(bytes: Uint8Array): Promise<string> {
  const buffer = Buffer.from(bytes)
  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    // Drop images instead of inlining them as base64.
    { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) }
  )
  const [header, footer] = await headerFooterText(buffer)
  return [header, htmlToText(html), footer].filter(Boolean).join("\n\n")
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      // Inside a table cell, paragraphs are just spaces.
      .replace(
        /<t([dh])\b[^>]*>([\s\S]*?)<\/t\1>/g,
        (_, tag: string, inner: string) =>
          `<t${tag}>${inner.replace(/<\/?p\b[^>]*>/g, " ")}</t${tag}>`
      )
      .replace(/<\/t[dh]>\s*(?=<t[dh]\b)/g, " | ")
      // Each <li> starts its own line, so </li> adds nothing (no blank lines).
      .replace(/<li\b[^>]*>/g, "\n- ")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<\/(p|h[1-6]|tr|ul|ol|table)>/g, "\n")
      .replace(/<[^>]+>/g, "")
  )
}

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (m, code: string) => {
      const c = code.toLowerCase()
      if (c.startsWith("#x"))
        return String.fromCodePoint(parseInt(c.slice(2), 16))
      if (c.startsWith("#"))
        return String.fromCodePoint(parseInt(c.slice(1), 10))
      return (
        { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[c] ?? m
      )
    }
  )
}

/** Text of all page headers and footers, deduplicated (first/even pages repeat). */
async function headerFooterText(buffer: Buffer): Promise<[string, string]> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const read = async (kind: "header" | "footer") => {
      const files = zip.file(new RegExp(`^word/${kind}\\d*\\.xml$`))
      const parts = await Promise.all(files.map((f) => f.async("string")))
      const lines = parts.flatMap(xmlParagraphs)
      return [...new Set(lines)].join("\n")
    }
    return [await read("header"), await read("footer")]
  } catch {
    return ["", ""]
  }
}

function xmlParagraphs(xml: string): string[] {
  return (xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [])
    .map((p) =>
      decodeEntities(
        p
          // Tabs and line breaks become text runs so only <w:t> needs reading.
          .replace(/<w:tab\b[^>]*\/>/g, "<w:t> </w:t>")
          .replace(/<w:br\b[^>]*\/>/g, "<w:t>\n</w:t>")
          .match(/<w:t\b[^>]*>[^<]*<\/w:t>/g)
          ?.map((t) => t.replace(/<[^>]+>/g, ""))
          .join("") ?? ""
      ).trim()
    )
    .filter(Boolean)
}
