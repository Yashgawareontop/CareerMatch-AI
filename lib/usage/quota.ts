// Token-bucket math for the usage page, matching @convex-dev/rate-limiter:
// tokens refill continuously at rate/period, up to capacity. Pure.

export interface BucketState {
  /** Tokens left at `ts`. */
  value: number
  /** When `value` was recorded; 0 for a bucket that was never used. */
  ts: number
  rate: number
  period: number
  capacity: number
}

/** Whole tokens available at `now`. */
export function availableTokens(b: BucketState, now: number): number {
  if (b.ts === 0) return b.capacity
  const refilled = b.value + ((now - b.ts) * b.rate) / b.period
  return Math.max(0, Math.floor(Math.min(b.capacity, refilled)))
}

/** Ms until one more token is available, or 0 if the bucket is full. */
export function msUntilNextToken(b: BucketState, now: number): number {
  if (availableTokens(b, now) >= b.capacity) return 0
  const exact =
    b.ts === 0 ? b.capacity : b.value + ((now - b.ts) * b.rate) / b.period
  const missing = Math.floor(exact) + 1 - exact
  return Math.ceil((missing * b.period) / b.rate)
}
