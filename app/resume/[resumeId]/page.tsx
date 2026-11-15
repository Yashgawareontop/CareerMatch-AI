"use client"

import { useConvexAuth } from "convex/react"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { use } from "react"

import { AnalysisView } from "@/components/analysis/analysis-view"
import { AppShell } from "@/components/app-shell"
import { LoadingState, SignedOutState } from "@/components/states"

export default function ResumeAnalysisPage({
  params,
}: {
  params: Promise<{ resumeId: string }>
}) {
  const { resumeId } = use(params)
  const { isLoading, isAuthenticated } = useConvexAuth()

  return (
    <AppShell
      title="Resume analysis"
      description={
        <Link
          href="/resume"
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" strokeWidth={1.5} aria-hidden />
          Your resumes
        </Link>
      }
    >
      {isLoading ? (
        <LoadingState rows={3} label="Loading analysis" />
      ) : !isAuthenticated ? (
        <SignedOutState next={`/resume/${resumeId}`} />
      ) : (
        <AnalysisView resumeId={resumeId} />
      )}
    </AppShell>
  )
}
