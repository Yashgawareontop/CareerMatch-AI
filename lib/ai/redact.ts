// Error text from AI providers can carry model output: Groq's JSON-mode
// errors embed `failed_generation`, the partial reply, which is derived from
// the prompt (a resume, a profile). Anything logged goes through this first.

const MAX = 300

/** An error message that is safe to log: no model output, bounded length. */
export function safeErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text
    .replace(
      /"?failed_generation"?\s*:[\s\S]*/i,
      "failed_generation: [removed]"
    )
    .slice(0, MAX)
}
