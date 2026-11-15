"use client"

import { useAuthToken } from "@convex-dev/auth/react"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { FileUp } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { MAX_RESUME_BYTES, RESUME_MIME_TYPES } from "@/convex/resumeLimits"
import { cn } from "@/lib/utils"

import { requestAnalyze, requestParse } from "./request-parse"

const ACCEPT = [
  ".pdf",
  ".docx",
  RESUME_MIME_TYPES.pdf,
  RESUME_MIME_TYPES.docx,
].join(",")

/** Some browsers report an empty type for .docx; fall back to the extension. */
function resumeMime(file: File): string | null {
  const name = file.name.toLowerCase()
  if (file.type === RESUME_MIME_TYPES.pdf || name.endsWith(".pdf")) {
    return RESUME_MIME_TYPES.pdf
  }
  if (file.type === RESUME_MIME_TYPES.docx || name.endsWith(".docx")) {
    return RESUME_MIME_TYPES.docx
  }
  return null
}

export function ResumeUpload() {
  const generateUploadUrl = useMutation(api.resumes.generateUploadUrl)
  const createResume = useMutation(api.resumes.create)
  const token = useAuthToken()
  // Read the token when each request is sent: access tokens live 60 s.
  const tokenRef = useRef(token)
  useEffect(() => {
    tokenRef.current = token
  }, [token])
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setError(null)
    const mime = resumeMime(file)
    if (mime === null) return setError("Only PDF and DOCX files are supported")
    if (file.size > MAX_RESUME_BYTES)
      return setError("This file is larger than 5 MB")
    if (file.size === 0) return setError("This file is empty")

    setBusy(true)
    try {
      const uploadUrl = await generateUploadUrl()
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mime },
        body: file,
      })
      if (!res.ok) throw new Error("upload failed")
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> }
      const resumeId = await createResume({
        storageId,
        fileName: file.name,
      })
      // Parsing, then analysis, continue in the background; the list below
      // shows progress.
      void (async () => {
        const parsed = await requestParse(resumeId, tokenRef.current)
        if (parsed.error) return setError(parsed.error)
        const analyzed = await requestAnalyze(resumeId, tokenRef.current)
        if (analyzed.error) setError(analyzed.error)
      })()
    } catch (e) {
      setError(
        e instanceof ConvexError && typeof e.data === "string"
          ? e.data
          : "Upload failed. Please try again."
      )
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file && !busy) void upload(file)
        }}
        className={cn(
          "flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-10 text-center transition-colors",
          dragging ? "border-brand bg-mark/40" : "border-foreground/15"
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <FileUp
            className="size-5 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden
          />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-medium">Drop your resume here</p>
          <p className="text-sm text-muted-foreground">
            PDF or DOCX up to 5 MB, scanned PDFs included
          </p>
        </div>
        <Button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : "Choose file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-label="Resume file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void upload(file)
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
