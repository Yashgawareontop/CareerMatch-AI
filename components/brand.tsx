import { cn } from "@/lib/utils"

/**
 * The CM monogram from `public/brand/logo-mark.png`, drawn as a mask so it
 * takes the current text color and follows light/dark theme.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-6 shrink-0 bg-current [mask:url(/brand/logo-mark.png)_center/contain_no-repeat]",
        className
      )}
    />
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
