"use client"

import { useConvexAuth, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useEffect, useState } from "react"

import { AppShell } from "@/components/app-shell"
import { LoadingState, Panel, SignedOutState } from "@/components/states"
import { api } from "@/convex/_generated/api"
import { availableTokens, msUntilNextToken } from "@/lib/usage/quota"
import { cn } from "@/lib/utils"

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

const LIMIT_COPY: Record<string, { label: string; what: string }> = {
  resumeUpload: {
    label: "Resume uploads",
    what: "Each file you upload",
  },
  resumeParse: {
    label: "Resume reads",
    what: "Reading the text out of a file, scanned ones included",
  },
  resumeAnalyze: {
    label: "AI analyses",
    what: "Extracting skills and goals from a resume",
  },
  matchRefresh: {
    label: "Match refreshes",
    what: "Re-ranking current listings for you",
  },
}

type Limits = NonNullable<FunctionReturnType<typeof api.usage.myLimits>>
type Service = NonNullable<FunctionReturnType<typeof api.usage.service>>

function per(period: number) {
  if (period === HOUR) return "per hour"
  if (period % HOUR === 0) return `per ${period / HOUR} hours`
  return `per ${Math.round(period / 60000)} minutes`
}

function wait(ms: number) {
  if (ms <= 0) return null
  const minutes = Math.ceil(ms / 60000)
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

const nf = new Intl.NumberFormat("en")

export default function UsagePage() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const limits = useQuery(api.usage.myLimits, isAuthenticated ? {} : "skip")
  // Fixed at mount: query arguments must not change every render.
  const [since] = useState(() => Date.now() - 7 * DAY)
  const service = useQuery(
    api.usage.service,
    isAuthenticated ? { since } : "skip"
  )
  // Buckets refill continuously; re-read the clock every 15 seconds.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <AppShell
      title="Usage"
      description="How much of each limit you have left. Limits refill on their own over time"
    >
      {isLoading || (isAuthenticated && limits === undefined) ? (
        <LoadingState rows={2} label="Loading usage" />
      ) : !isAuthenticated || limits === null ? (
        <SignedOutState next="/usage" />
      ) : (
        <>
          <Panel
            title="Your limits"
            description="Limits keep AI costs fair for everyone. Each action uses one"
          >
            <ul className="flex flex-col divide-y">
              {limits!.map((l) => (
                <LimitRow key={l.name} limit={l} now={now} />
              ))}
            </ul>
          </Panel>

          {service && <ServiceUsage data={service} />}
        </>
      )}
    </AppShell>
  )
}

function LimitRow({ limit, now }: { limit: Limits[number]; now: number }) {
  const copy = LIMIT_COPY[limit.name]
  const left = availableTokens(limit, now)
  const next = wait(msUntilNextToken(limit, now))
  const pct = Math.round((left / limit.capacity) * 100)
  return (
    <li className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{copy.label}</span>
        <span className="text-sm text-muted-foreground">
          {copy.what}. Refills {limit.rate} {per(limit.period)}, up to{" "}
          {limit.capacity} at once
        </span>
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-48">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-mono tabular-nums">
            {left}
            <span className="text-muted-foreground"> of {limit.capacity}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {next ? `+1 in ${next}` : "Full"}
          </span>
        </div>
        <span
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label={`${copy.label}: ${left} of ${limit.capacity} available`}
          aria-valuemin={0}
          aria-valuemax={limit.capacity}
          aria-valuenow={left}
        >
          <span
            className={cn(
              "block h-full rounded-full transition-[width] duration-500 ease-out",
              left === 0 ? "bg-destructive" : "bg-brand"
            )}
            style={{ width: `${pct}%` }}
          />
        </span>
      </div>
    </li>
  )
}

/** Admin only (ADMIN_USER_IDS on Convex): service-wide AI calls, 7 days. */
function ServiceUsage({ data }: { data: Service }) {
  const tokens = data.byModel.reduce(
    (n, b) => n + b.inputTokens + b.outputTokens,
    0
  )
  const failed = data.byModel.reduce((n, b) => n + b.failed, 0)
  const limited = data.byModel.reduce((n, b) => n + b.rateLimited, 0)
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="AI requests, 7 days" value={nf.format(data.total)} />
        <Stat label="Tokens" value={nf.format(tokens)} />
        <Stat label="Failed" value={nf.format(failed)} />
        <Stat label="Rate limited (429)" value={nf.format(limited)} />
      </dl>
      {data.truncated && (
        <p className="text-xs text-muted-foreground">
          Showing the newest {nf.format(data.total)} requests only
        </p>
      )}
      <Panel
        title="By model"
        description="Service-wide, visible to admins only. Metadata only, never prompts or replies"
      >
        <UsageTable rows={data.byModel} keyLabel="Provider and model" />
      </Panel>
      <Panel title="By feature">
        <UsageTable rows={data.byFeature} keyLabel="Feature" />
      </Panel>
      <Panel title="By day (UTC)">
        <UsageTable rows={data.byDay} keyLabel="Day" />
      </Panel>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-card px-5 py-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-mono text-[28px] leading-none tabular-nums">
        {value}
      </dd>
    </div>
  )
}

function UsageTable({
  rows,
  keyLabel,
}: {
  rows: Service["byModel"]
  keyLabel: string
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">No requests yet</p>
  return (
    <div className="-mx-1 overflow-x-auto" data-lenis-prevent>
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-1 py-2 font-normal">{keyLabel}</th>
            {[
              "Requests",
              "Failed",
              "429s",
              "Tokens in",
              "Tokens out",
              "p50",
              "p95",
            ].map((h) => (
              <th key={h} className="px-1 py-2 text-right font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono text-xs tabular-nums">
          {rows.map((r) => (
            <tr key={r.key} className="border-b last:border-0">
              <td className="max-w-56 truncate px-1 py-2 font-sans text-sm">
                {r.key}
              </td>
              <td className="px-1 py-2 text-right">{nf.format(r.calls)}</td>
              <td className="px-1 py-2 text-right">{nf.format(r.failed)}</td>
              <td className="px-1 py-2 text-right">
                {nf.format(r.rateLimited)}
              </td>
              <td className="px-1 py-2 text-right">
                {nf.format(r.inputTokens)}
              </td>
              <td className="px-1 py-2 text-right">
                {nf.format(r.outputTokens)}
              </td>
              <td className="px-1 py-2 text-right">
                {(r.p50Ms / 1000).toFixed(1)}s
              </td>
              <td className="px-1 py-2 text-right">
                {(r.p95Ms / 1000).toFixed(1)}s
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
