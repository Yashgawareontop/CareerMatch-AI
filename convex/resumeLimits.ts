// Shared by Convex functions, the parse route, and the upload UI.

export const MAX_RESUME_BYTES = 5 * 1024 * 1024

export const RESUME_MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const

/** Longest text we store. A real resume is far shorter than this. */
export const MAX_RESUME_TEXT = 100_000

/** A parse that has run this long is treated as crashed and may be retried. */
export const PARSE_TIMEOUT_MS = 3 * 60 * 1000

/** An analysis that has run this long is treated as crashed and may be rerun. */
export const ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000
