import Link from "next/link"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Placeholder rows while a query loads. */
export function LoadingState({
  rows = 3,
  className,
  label = "Loading",
}: {
  rows?: number
  className?: string
  label?: string
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("flex flex-col gap-3", className)}
    >
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  )
}

/**
 * Background work in progress, like parsing or ranking. The dot is the only
 * thing that moves, because the work is actually live.
 */
export function WorkingState({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground",
        className
      )}
    >
      <span className="relative flex size-2 shrink-0" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-brand opacity-40 motion-safe:animate-ping" />
        <span className="relative size-2 rounded-full bg-brand" />
      </span>
      {children}
    </p>
  )
}

/** A "nothing here yet" box, with an optional next step. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed bg-card/60 p-6">
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        {children && (
          <div className="max-w-prose text-sm text-muted-foreground">
            {children}
          </div>
        )}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {children}
    </p>
  )
}

export function SignedOutState({ next }: { next: string }) {
  return (
    <p className="text-sm">
      Your session has ended.{" "}
      <Link
        href={`/sign-in?next=${encodeURIComponent(next)}`}
        className="underline underline-offset-4"
      >
        Sign in again
      </Link>
    </p>
  )
}

/** A raised content block with a title row. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  ...props
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
} & Omit<React.ComponentProps<"section">, "title">) {
  return (
    <section
      data-reveal
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6",
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title && <h2 className="font-medium">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
