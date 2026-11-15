"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { useRouter } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { ProfileForm } from "@/components/profile/profile-form"
import { LoadingState, SignedOutState } from "@/components/states"
import { api } from "@/convex/_generated/api"

export default function OnboardingPage() {
  const router = useRouter()
  const { isLoading, isAuthenticated } = useConvexAuth()
  const skip = isAuthenticated ? {} : "skip"
  const profile = useQuery(api.profiles.getMine, skip)
  const resumes = useQuery(api.resumes.listMine, skip)

  return (
    <AppShell
      title="Career preferences"
      description="We use these with your resume to rank internships and jobs"
    >
      {isLoading || (isAuthenticated && profile === undefined) ? (
        <LoadingState rows={2} label="Loading preferences" />
      ) : !isAuthenticated ? (
        <SignedOutState next="/onboarding" />
      ) : (
        // Re-mount when the profile first appears so defaults are filled in.
        <div className="rounded-2xl border bg-card p-5 sm:p-6">
          <ProfileForm
            key={profile?._id ?? "new"}
            profile={profile ?? null}
            // First-time setup continues to the resume upload.
            onSaved={() => {
              if (profile === null && resumes?.length === 0)
                router.push("/resume")
            }}
          />
        </div>
      )}
    </AppShell>
  )
}
