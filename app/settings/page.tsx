"use client"

import { useAuthActions } from "@convex-dev/auth/react"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useState, useSyncExternalStore } from "react"

import { AppShell } from "@/components/app-shell"
import { ErrorState, Panel } from "@/components/states"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <Appearance />
      <Section title="Resume and preferences">
        <p className="text-sm text-muted-foreground">
          Upload a new resume to re-analyze your skills. Your matches update
          afterwards.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/resume" className={buttonVariants()}>
            Upload a new resume
          </Link>
          <Link
            href="/onboarding"
            className={buttonVariants({ variant: "outline" })}
          >
            Edit preferences
          </Link>
        </div>
      </Section>
      <Section title="Privacy">
        <p className="text-sm text-muted-foreground">
          Your resume text is sent to Google Gemini or Groq to extract skills,
          and your skills and goals are sent to them to rank and explain
          matches. Resume text is never written to our logs. You can delete
          everything below.
        </p>
      </Section>
      <DeleteAccount />
    </AppShell>
  )
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Panel title={title} className={cn("gap-3", className)}>
      {children}
    </Panel>
  )
}

const noopSubscribe = () => () => {}

function Appearance() {
  const { theme: storedTheme, setTheme } = useTheme()
  // The stored theme only exists on the client; render "unknown" until
  // hydrated so server and client markup match.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
  const theme = mounted ? storedTheme : undefined
  return (
    <Section title="Appearance">
      <div
        role="radiogroup"
        aria-label="Theme"
        className="flex w-fit gap-0.5 rounded-lg bg-muted p-[3px]"
      >
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={theme === t.value}
            onClick={() => setTheme(t.value)}
            className={cn(
              "h-8 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              theme === t.value
                ? "bg-card font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </Section>
  )
}

function DeleteAccount() {
  const deleteMine = useMutation(api.account.deleteMine)
  const { signOut } = useAuthActions()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      await deleteMine({})
    } catch (e) {
      setPending(false)
      setError(
        e instanceof ConvexError
          ? String(e.data)
          : "Could not delete your account"
      )
      return
    }
    // Sessions are already revoked; this clears the local cookies.
    await signOut().catch(() => {})
    router.replace("/")
    router.refresh()
  }

  return (
    <Section title="Delete account" className="border-destructive/25">
      <p className="text-sm text-muted-foreground">
        Permanently deletes your account, resumes, analyses, preferences,
        matches and tracker. This can&apos;t be undone.
      </p>
      {error && <ErrorState>{error}</ErrorState>}
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="destructive"
              className="self-start"
              disabled={pending}
            />
          }
        >
          {pending ? "Deleting…" : "Delete my account"}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              All your data is removed right away and you&apos;ll be signed out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={confirm}
            >
              {pending ? "Deleting…" : "Delete everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}
