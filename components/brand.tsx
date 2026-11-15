import { cn } from "@/lib/utils"

/** A flat mark: a resume page with one line highlighted. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn("size-5 shrink-0", className)}
      aria-hidden
    >
      <rect
        x="3.75"
        y="1.75"
        width="12.5"
        height="16.5"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="6.5"
        y="5.5"
        width="7"
        height="1.5"
        rx="0.75"
        fill="currentColor"
        opacity="0.45"
      />
      <rect
        x="5.75"
        y="8.75"
        width="8.5"
        height="3"
        rx="1"
        fill="var(--brand)"
      />
      <rect
        x="6.5"
        y="13.5"
        width="5"
        height="1.5"
        rx="0.75"
        fill="currentColor"
        opacity="0.45"
      />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.025em]",
        className
      )}
    >
      <BrandMark />
      CareerMatch AI
    </span>
  )
}
