"use client"

import { useMutation } from "convex/react"
import { ConvexError, type Infer } from "convex/values"
import { BookmarkIcon, CheckIcon, EyeOffIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { feedbackStatusValidator } from "@/convex/schema"

export type Feedback = Infer<typeof feedbackStatusValidator>

/** Save / Mark applied / Not interested. Clicking the active one clears it. */
export function FeedbackButtons({
  jobId,
  feedback,
  showDismiss = true,
}: {
  jobId: Id<"jobs">
  feedback: Feedback | null
  showDismiss?: boolean
}) {
  const setFeedback = useMutation(api.matches.setFeedback)
  const [error, setError] = useState<string | null>(null)

  async function mark(status: Feedback) {
    setError(null)
    try {
      await setFeedback({ jobId, status: feedback === status ? null : status })
    } catch (e) {
      setError(
        e instanceof ConvexError ? String(e.data) : "Could not save that"
      )
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={feedback === "saved" ? "default" : "outline"}
          aria-pressed={feedback === "saved"}
          onClick={() => mark("saved")}
        >
          <BookmarkIcon
            strokeWidth={1.5}
            className={feedback === "saved" ? "fill-current" : undefined}
            aria-hidden
          />
          {feedback === "saved" ? "Saved" : "Save"}
        </Button>
        <Button
          size="sm"
          variant={feedback === "applied" ? "default" : "outline"}
          aria-pressed={feedback === "applied"}
          onClick={() => mark("applied")}
        >
          <CheckIcon strokeWidth={1.5} aria-hidden />
          {feedback === "applied" ? "Applied" : "Mark applied"}
        </Button>
        {showDismiss && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            aria-pressed={feedback === "dismissed"}
            onClick={() => mark("dismissed")}
          >
            <EyeOffIcon strokeWidth={1.5} aria-hidden />
            {feedback === "dismissed" ? "Hidden, undo" : "Not interested"}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
