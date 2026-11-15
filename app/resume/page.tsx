"use client"

import { useConvexAuth } from "convex/react"

import { AppShell } from "@/components/app-shell"
import { ResumeList } from "@/components/resume/resume-list"
import { ResumeUpload } from "@/components/resume/resume-upload"
import { LoadingState, SignedOutState } from "@/components/states"

export default function ResumePage() {
  const { isLoading, isAuthenticated } = useConvexAuth()

  return (
    <AppShell
      title="Your resume"
      description="We read the text to find your skills, then match you with roles"
    >
      {isLoading ? (
        <LoadingState rows={2} label="Loading resumes" />
      ) : !isAuthenticated ? (
        <SignedOutState next="/resume" />
      ) : (
        <>
          <ResumeUpload />
          <section className="flex flex-col gap-3">
            <h2 className="font-medium">Uploads</h2>
            <ResumeList />
          </section>
        </>
      )}
    </AppShell>
  )
}
