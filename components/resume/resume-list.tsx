"use client"

import { useAuthToken } from "@convex-dev/auth/react"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import Link from "next/link"
import { useState } from "react"

import { FileTextIcon } from "lucide-react"

import { LoadingState, WorkingState } from "@/components/states"
import { Button, buttonVariants } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"

import { requestAnalyze, requestParse } from "./request-parse"

type Status = "uploaded" | "parsing" | "parsed" | "failed"

const STATUS_LABEL: Record<Status, string> = {
  uploaded: "Uploaded",
  parsing: "Reading…",
  parsed: "Ready",
  failed: "Failed",
}

// A status dot in front of a quiet label; only the live state moves.
const STATUS_DOT: Record<Status, string> = {
  uploaded: "bg-muted-foreground/50",
  parsing: "bg-brand motion-safe:animate-pulse",
  parsed: "bg-positive",
  failed: "bg-destructive",
}

const METHOD_LABEL: Record<string, string> = {
  pdf: "PDF text",
  docx: "DOCX text",
  "pdf-ocr": "scanned PDF (AI read)",
}

export function ResumeList() {
  const resumes = useQuery(api.resumes.listMine)

  if (resumes === undefined) {
    return <LoadingState rows={1} label="Loading resumes" />
  }
  if (resumes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No resumes uploaded yet</p>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {resumes.map((r) => (
        <ResumeItem key={r._id} resume={r} />
      ))}
    </ul>
  )
}

function ResumeItem({ resume }: { resume: ResumeSummary }) {
  const remove = useMutation(api.resumes.remove)
  const token = useAuthToken()
  const [showFull, setShowFull] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const canRetry = resume.status === "failed" || resume.status === "uploaded"

  async function retry() {
    setActionError(null)
    setRetrying(true)
    const { error } = await requestParse(resume._id, token)
    setRetrying(false)
    // A failed parse is already shown from the row itself.
    if (error && error !== resume.error) setActionError(error)
  }

  return (
    <li className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <FileTextIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">
              {resume.fileName}
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {new Date(resume._creationTime).toLocaleString("en", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {resume.parseMethod &&
                ` · ${METHOD_LABEL[resume.parseMethod] ?? resume.parseMethod}`}
              {resume.status === "parsed" &&
                ` · ${resume.textLength.toLocaleString("en")} characters`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <span
              className={cn("size-1.5 rounded-full", STATUS_DOT[resume.status])}
              aria-hidden
            />
            {STATUS_LABEL[resume.status]}
          </span>
          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              disabled={retrying}
              onClick={retry}
            >
              {resume.status === "failed" ? "Retry" : "Parse"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={resume.status === "parsing"}
            onClick={() => void remove({ resumeId: resume._id })}
          >
            Delete
          </Button>
        </div>
      </div>

      {resume.error && (
        <p className="text-sm text-destructive">{resume.error}</p>
      )}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {resume.status === "parsed" && <AnalysisRow resume={resume} />}

      {resume.preview && (
        <div className="flex flex-col gap-2">
          {showFull ? (
            <FullText resumeId={resume._id} />
          ) : (
            <pre className="max-h-40 overflow-hidden rounded-lg bg-muted/60 [mask-image:linear-gradient(to_bottom,#000_60%,transparent)] p-3 font-mono text-xs leading-5 whitespace-pre-wrap text-muted-foreground">
              {resume.preview}
            </pre>
          )}
          <Button
            size="xs"
            variant="link"
            className="self-start px-0"
            onClick={() => setShowFull((s) => !s)}
          >
            {showFull ? "Show less" : "Show extracted text"}
          </Button>
        </div>
      )}
    </li>
  )
}

function FullText({ resumeId }: { resumeId: Id<"resumes"> }) {
  const resume = useQuery(api.resumes.getMine, { resumeId })
  if (resume === undefined)
    return <p className="text-xs text-muted-foreground">Loading…</p>
  return (
    <pre className="max-h-[32rem] overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
      {resume?.rawText ?? ""}
    </pre>
  )
}

type ResumeSummary = FunctionReturnType<typeof api.resumes.listMine>[number]

/** Analysis status for a parsed resume, with Analyze / View actions. */
function AnalysisRow({ resume }: { resume: ResumeSummary }) {
  const token = useAuthToken()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const analysis = resume.analysis
  const running = busy || analysis?.status === "running"

  async function analyze() {
    setError(null)
    setBusy(true)
    const result = await requestAnalyze(resume._id, token)
    setBusy(false)
    if (result.error && result.error !== analysis?.error) setError(result.error)
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {running ? (
          <WorkingState className="text-foreground">
            Analyzing skills and goals. This takes about 10 to 30 seconds
          </WorkingState>
        ) : (
          <span className="text-sm">
            {analysis?.status === "done"
              ? "Skills and career goals extracted"
              : analysis?.status === "failed"
                ? "Analysis failed"
                : "Not analyzed yet"}
          </span>
        )}
        <div className="flex items-center gap-2">
          {analysis?.status === "done" && (
            <Link
              href={`/resume/${resume._id}`}
              className={buttonVariants({ size: "sm" })}
            >
              View analysis
            </Link>
          )}
          {!running && analysis?.status !== "done" && (
            <Button size="sm" variant="outline" onClick={analyze}>
              {analysis?.status === "failed" ? "Retry analysis" : "Analyze"}
            </Button>
          )}
        </div>
      </div>
      {!running && analysis?.status === "failed" && analysis.error && (
        <p className="text-sm text-destructive">{analysis.error}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
