import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="font-mono text-sm text-muted-foreground">404</span>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground">
          This page doesn&apos;t exist, or it moved
        </p>
        <Link href="/" className={buttonVariants()}>
          Back to home
        </Link>
      </div>
    </main>
  )
}
