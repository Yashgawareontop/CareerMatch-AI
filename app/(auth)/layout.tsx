import Link from "next/link"
import { ViewTransition } from "react"

import { Wordmark } from "@/components/brand"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-8">
        <Link href="/" aria-label="CareerMatch AI home">
          <Wordmark />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-12 pb-24 sm:items-center sm:pt-0">
        <ViewTransition enter="page-enter" exit="page-exit" default="none">
          {children}
        </ViewTransition>
      </main>
    </div>
  )
}
