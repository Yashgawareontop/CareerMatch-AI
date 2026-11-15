"use client"

import { useAuthActions } from "@convex-dev/auth/react"
import { LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SignOutButton({
  compact = false,
  className,
}: {
  /** Icon only, for the mobile top bar. */
  compact?: boolean
  className?: string
}) {
  const { signOut } = useAuthActions()
  const router = useRouter()
  const [pending, setPending] = useState(false)

  return (
    <Button
      variant="ghost"
      size={compact ? "icon" : "default"}
      disabled={pending}
      aria-label={compact ? "Sign out" : undefined}
      className={cn(
        !compact && "justify-start gap-2.5 px-2.5 text-muted-foreground",
        className
      )}
      onClick={async () => {
        setPending(true)
        try {
          await signOut()
        } finally {
          router.replace("/sign-in")
          router.refresh()
        }
      }}
    >
      <LogOutIcon strokeWidth={1.5} aria-hidden />
      {!compact && (pending ? "Signing out…" : "Sign out")}
    </Button>
  )
}
