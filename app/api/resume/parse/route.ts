import { fetchMutation } from "convex/nextjs"
import { ConvexError } from "convex/values"
import { z } from "zod"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { MAX_RESUME_BYTES } from "@/convex/resumeLimits"
import { convexAuthNextjsAccessToken } from "@/lib/auth/server"
import { serverEnv } from "@/lib/env"
import { parseResume, ResumeParseError } from "@/lib/resume"

// pdf.js, mammoth and Buffer need Node; OCR of a scanned PDF can be slow.
export const runtime = "nodejs"
export const maxDuration = 60

const bodySchema = z.object({ resumeId: z.string().min(1).max(64) })

/**
 * POST /api/resume/parse  { resumeId }
 * Downloads the user's uploaded resume from Convex storage, extracts its text,
 * and writes the result (or a readable error) back to the `resumes` row.
 *
 * The user's token is used only for `startParsing`, which checks ownership.
 * Results are reported with RESUME_PARSER_SECRET, because access tokens live
 * 60s (OCR can take longer) and users must not write parsed text themselves.
 */
export async function POST(request: Request) {
  const secret = serverEnv().RESUME_PARSER_SECRET
  if (!secret) {
    console.error("[resume/parse] RESUME_PARSER_SECRET is not set")
    return Response.json(
      { error: "Resume parsing is not configured" },
      { status: 500 }
    )
  }

  const token = bearerToken(request) ?? (await convexAuthNextjsAccessToken())
  if (!token) return Response.json({ error: "Not signed in" }, { status: 401 })

  const body = bodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return Response.json({ error: "Expected { resumeId }" }, { status: 400 })
  }
  const resumeId = body.data.resumeId as Id<"resumes">

  let fileUrl: string
  let attempt: number
  try {
    ;({ fileUrl, attempt } = await fetchMutation(
      api.resumes.startParsing,
      { resumeId },
      { token }
    ))
  } catch (error) {
    const message =
      error instanceof ConvexError
        ? String(error.data)
        : "Could not start parsing"
    const status = message.startsWith("Too many")
      ? 429
      : message === "Not signed in"
        ? 401
        : 400
    return Response.json({ error: message }, { status })
  }

  const report = { secret, resumeId, attempt }
  try {
    const bytes = await download(fileUrl)
    const { text, method } = await parseResume(bytes)
    await fetchMutation(api.resumes.completeParsing, {
      ...report,
      rawText: text,
      parseMethod: method,
    })
    return Response.json({ status: "parsed", method, length: text.length })
  } catch (error) {
    const message =
      error instanceof ResumeParseError
        ? error.message
        : "Something went wrong while reading this file. Please try again."
    if (!(error instanceof ResumeParseError)) {
      console.error("[resume/parse] unexpected error", error)
    }
    await fetchMutation(api.resumes.failParsing, {
      ...report,
      error: message,
    }).catch((e) => console.error("[resume/parse] could not record failure", e))
    return Response.json({ status: "failed", error: message }, { status: 422 })
  }
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization")
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok)
    throw new ResumeParseError("Could not download the uploaded file.")
  const length = Number(res.headers.get("content-length") ?? 0)
  if (length > MAX_RESUME_BYTES)
    throw new ResumeParseError("File is larger than 5 MB.")
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength > MAX_RESUME_BYTES) {
    throw new ResumeParseError("File is larger than 5 MB.")
  }
  return bytes
}
