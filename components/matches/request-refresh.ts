/**
 * Asks the Next.js server to recompute the user's recommendations. The
 * result shows up live through `matches.mine`, so only errors come back.
 */
export async function requestMatchRefresh(
  token: string | null
): Promise<{ error: string | null }> {
  try {
    const res = await fetch("/api/matches/refresh", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) return { error: null }
    const data: unknown = await res.json().catch(() => null)
    const error =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Could not update your recommendations."
    return { error }
  } catch {
    return { error: "Network error. Check your connection and try again." }
  }
}
