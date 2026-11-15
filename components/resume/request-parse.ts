import type { Id } from "@/convex/_generated/dataModel"

/**
 * Asks the Next.js server to parse an uploaded resume. Status changes reach
 * the UI through the live `resumes.listMine` query, so the caller only needs
 * the error (if the request itself was refused).
 */
export function requestParse(resumeId: Id<"resumes">, token: string | null) {
  return postResumeAction(
    "/api/resume/parse",
    resumeId,
    token,
    "Could not parse this resume."
  )
}

/**
 * Asks the Next.js server to run the AI analysis of a parsed resume. Progress
 * shows up live through the `analyses` queries.
 */
export function requestAnalyze(resumeId: Id<"resumes">, token: string | null) {
  return postResumeAction(
    "/api/resume/analyze",
    resumeId,
    token,
    "Could not analyze this resume."
  )
}

async function postResumeAction(
  path: string,
  resumeId: Id<"resumes">,
  token: string | null,
  fallbackError: string
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ resumeId }),
    })
    if (res.ok) return { error: null }
    const data: unknown = await res.json().catch(() => null)
    const error =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : fallbackError
    return { error }
  } catch {
    return { error: "Network error. Check your connection and try again." }
  }
}
