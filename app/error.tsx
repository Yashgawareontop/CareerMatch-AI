"use client" // Error boundaries must be Client Components

import Link from "next/link"
import { useEffect } from "react"

import { Button, buttonVariants } from "@/components/ui/button"

export default function Error({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div
        role="alert"
        className="flex max-w-md flex-col items-center gap-4 text-center"
      >
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground">
          This page couldn&apos;t load. Check your connection and try again.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => retry()}>Try again</Button>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline" })}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
