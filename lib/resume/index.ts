import "server-only"

import { fileTypeFromBuffer } from "file-type"
import { extractText as extractPdfText, getDocumentProxy } from "unpdf"

import { RESUME_MIME_TYPES } from "@/convex/resumeLimits"
import { getFileCapableProvider } from "@/lib/ai"

import { cleanResumeText, contentLength } from "./clean"
import { docxToText } from "./docx"

export { cleanResumeText } from "./clean"

export type ResumeMime =
  (typeof RESUME_MIME_TYPES)[keyof typeof RESUME_MIME_TYPES]
export type ParseMethod = "pdf" | "docx" | "pdf-ocr"

/** Below this many letters/digits a PDF is treated as scanned (image only). */
const SCANNED_BELOW_CHARS = 150
/** Below this many letters/digits there is nothing worth storing. */
const MIN_USABLE_CHARS = 30

/** A parse error whose message is safe to show to the user. */
export class ResumeParseError extends Error {
  override name = "ResumeParseError"
}

/** The real file type, from the file's bytes rather than its name. */
export async function detectResumeType(
  bytes: Uint8Array
): Promise<ResumeMime | null> {
  const type = await fileTypeFromBuffer(bytes)
  if (type?.mime === RESUME_MIME_TYPES.pdf) return RESUME_MIME_TYPES.pdf
  if (type?.mime === RESUME_MIME_TYPES.docx) return RESUME_MIME_TYPES.docx
  return null
}

/** Extracts and cleans the text layer of a PDF or DOCX. No AI involved. */
export async function extractText(
  bytes: Uint8Array,
  mime: ResumeMime
): Promise<string> {
  if (mime === RESUME_MIME_TYPES.docx) {
    try {
      return cleanResumeText(await docxToText(bytes))
    } catch {
      throw new ResumeParseError(
        "Could not read this DOCX file. Is it corrupted?"
      )
    }
  }

  try {
    // pdf.js may transfer (detach) the buffer it is given, so pass a copy.
    const pdf = await getDocumentProxy(bytes.slice())
    const { text } = await extractPdfText(pdf, { mergePages: false })
    await pdf.cleanup()
    return cleanResumeText(text.join("\n\n"))
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") {
      throw new ResumeParseError(
        "This PDF is password-protected. Remove the password and upload again."
      )
    }
    throw new ResumeParseError("Could not read this PDF file. Is it corrupted?")
  }
}

const OCR_PROMPT = `This file is a resume. Transcribe all of its text as plain text.
- Keep the original reading order and section headings.
- Put each bullet point on its own line, starting with "- ".
- Do not summarize, translate, correct, or add anything.
- Reply with the transcribed text only, no commentary or markdown fences.
If the file contains no readable text, reply with an empty response.`

async function ocrPdf(bytes: Uint8Array): Promise<string> {
  const ai = getFileCapableProvider()
  if (ai === null)
    throw new Error("ocrPdf called without a file-capable AI provider")
  let reply: string
  try {
    reply = await ai.generateText({
      prompt: OCR_PROMPT,
      temperature: 0,
      files: [{ data: bytes, mimeType: RESUME_MIME_TYPES.pdf }],
      feature: "ocr",
      // The parse route allows 60 s in total.
      timeoutMs: 40_000,
      attempts: 2,
    })
  } catch (error) {
    console.error("[resume] OCR request failed", error)
    throw new ResumeParseError(
      "Could not read this scanned PDF right now. Please try again."
    )
  }
  return cleanResumeText(reply.replace(/^```[a-z]*\n?|\n?```$/g, ""))
}

/**
 * Full pipeline: detect the real type, extract text, and fall back to AI OCR
 * for PDFs that have (almost) no text layer.
 */
export async function parseResume(
  bytes: Uint8Array
): Promise<{ text: string; method: ParseMethod }> {
  const mime = await detectResumeType(bytes)
  if (mime === null) {
    throw new ResumeParseError(
      "This file is not a PDF or DOCX. Please upload one of those."
    )
  }

  const text = await extractText(bytes, mime)
  const found = contentLength(text)

  if (mime === RESUME_MIME_TYPES.docx) {
    // DOCX has no image-only variant, so only reject a (nearly) empty file.
    if (found < MIN_USABLE_CHARS) {
      throw new ResumeParseError("This DOCX has almost no text in it.")
    }
    return { text, method: "docx" }
  }

  if (found >= SCANNED_BELOW_CHARS) return { text, method: "pdf" }

  // Little or no text layer: probably scanned. Read it with AI when possible.
  const canOcr = getFileCapableProvider() !== null
  if (canOcr) {
    const ocrText = await ocrPdf(bytes)
    const ocrFound = contentLength(ocrText)
    if (ocrFound > found && ocrFound >= MIN_USABLE_CHARS) {
      return { text: ocrText, method: "pdf-ocr" }
    }
  }
  // No OCR (or it found less): keep a short text layer if it is usable.
  if (found >= MIN_USABLE_CHARS) return { text, method: "pdf" }
  throw new ResumeParseError(
    canOcr
      ? "Could not find readable text in this PDF."
      : "This looks like a scanned PDF, and reading scanned files needs a Gemini API key. Upload a text-based PDF or DOCX instead."
  )
}
