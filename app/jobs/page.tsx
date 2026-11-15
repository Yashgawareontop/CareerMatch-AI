"use client"

import { usePaginatedQuery, useQuery } from "convex/react"
import { SearchIcon } from "lucide-react"
import { useDeferredValue, useState } from "react"

import { AppShell } from "@/components/app-shell"
import { JobCard } from "@/components/jobs/job-card"
import { JobDrawer } from "@/components/jobs/job-drawer"
import { EmptyState, LoadingState, WorkingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { SOURCE_CREDITS } from "@/lib/jobs/credits"
import type { JobKind } from "@/lib/jobs/types"
import { cn } from "@/lib/utils"

const DAY = 24 * 60 * 60 * 1000

const TYPES: { value: JobKind | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "internship", label: "Internships" },
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
]

const POSTED: { days: number | undefined; label: string }[] = [
  { days: undefined, label: "Any time" },
  { days: 1, label: "Last 24 hours" },
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
]

type RemoteFilter = "any" | "remote" | "onsite"

const selectClass =
  "h-9 rounded-lg border border-input bg-card px-2.5 text-sm transition-[border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 dark:bg-input/30"

export default function JobsPage() {
  const [type, setType] = useState<JobKind | undefined>(undefined)
  const [remote, setRemote] = useState<RemoteFilter>("any")
  const [postedDays, setPostedDays] = useState<number | undefined>(undefined)
  // Fixed when the filter is picked: a query argument must not change every render.
  const [postedAfter, setPostedAfter] = useState<number | undefined>(undefined)
  const [locationText, setLocationText] = useState("")
  const [text, setText] = useState("")
  const [openJob, setOpenJob] = useState<Id<"jobs"> | null>(null)

  const query = useDeferredValue(text.trim())
  const location = useDeferredValue(locationText.trim())
  const remoteArg = remote === "any" ? undefined : remote === "remote"

  const listing = usePaginatedQuery(
    api.jobs.browse,
    query
      ? "skip"
      : {
          type,
          remote: remoteArg,
          postedAfter,
          location: location || undefined,
        },
    { initialNumItems: 30 }
  )
  const lastSync = useQuery(api.jobs.lastSync)
  const results = useQuery(
    api.jobs.search,
    query ? { text: query, type, remote: remoteArg } : "skip"
  )

  const searched = results?.filter(
    (job) =>
      (postedAfter === undefined || job.postedAt > postedAfter) &&
      (!location || job.location.toLowerCase().includes(location.toLowerCase()))
  )
  const jobs = query ? searched : listing.results
  const loading = query
    ? results === undefined
    : listing.status === "LoadingFirstPage"
  const filtered =
    type !== undefined ||
    remote !== "any" ||
    postedDays !== undefined ||
    !!location

  function clearFilters() {
    setType(undefined)
    setRemote("any")
    setPostedDays(undefined)
    setPostedAfter(undefined)
    setLocationText("")
  }

  return (
    <AppShell
      title="Jobs and internships"
      description={
        lastSync ? (
          <>
            Current listings from public job boards, last refreshed{" "}
            {new Date(lastSync.finishedAt).toLocaleDateString("en", {
              month: "short",
              day: "numeric",
            })}
          </>
        ) : (
          "Current listings from public job boards, refreshed daily"
        )
      }
      wide
    >
      {lastSync && lastSync.failedSources.length > 0 && (
        <p
          role="status"
          className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
        >
          {lastSync.failedSources
            .map((source) => SOURCE_CREDITS[source].name)
            .join(", ")}{" "}
          couldn&apos;t be reached in the last refresh, so their newest listings
          may be missing. Everything else is up to date.
        </p>
      )}

      <section
        aria-label="Filters"
        className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5"
      >
        <div className="relative">
          <Label htmlFor="job-search" className="sr-only">
            Search
          </Label>
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden
          />
          <Input
            id="job-search"
            type="search"
            placeholder="Search titles and descriptions"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-10 pl-9"
          />
        </div>

        <div
          role="group"
          aria-label="Job type"
          className="flex w-full gap-0.5 overflow-x-auto rounded-lg bg-muted p-[3px] sm:w-fit"
        >
          {TYPES.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-pressed={type === t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "h-8 shrink-0 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                type === t.value
                  ? "bg-card font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job-remote">Work mode</Label>
            <select
              id="job-remote"
              className={selectClass}
              value={remote}
              onChange={(e) => setRemote(e.target.value as RemoteFilter)}
            >
              <option value="any">Any</option>
              <option value="remote">Remote only</option>
              <option value="onsite">On-site or hybrid</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job-location">Location</Label>
            <Input
              id="job-location"
              placeholder="e.g. Berlin, India"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job-posted">Posted</Label>
            <select
              id="job-posted"
              className={selectClass}
              value={postedDays ?? ""}
              onChange={(e) => {
                const days = e.target.value ? Number(e.target.value) : undefined
                setPostedDays(days)
                setPostedAfter(days ? Date.now() - days * DAY : undefined)
              }}
            >
              {POSTED.map((p) => (
                <option key={p.label} value={p.days ?? ""}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        )}
      </section>

      {loading ? (
        <LoadingState rows={4} label="Loading listings" />
      ) : !jobs || jobs.length === 0 ? (
        query || listing.status !== "CanLoadMore" ? (
          <EmptyState
            title="No listings found"
            action={
              filtered && (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          >
            Try a different search or fewer filters
          </EmptyState>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Nothing matches in the newest listings
            </p>
            <Button variant="outline" onClick={() => listing.loadMore(60)}>
              Search older listings
            </Button>
          </div>
        )
      ) : (
        <section aria-label="Listings" className="grid gap-3 md:grid-cols-2">
          {jobs.map((job) => (
            <JobCard
              key={job._id}
              job={job}
              onOpen={() => setOpenJob(job._id)}
            />
          ))}
          {!query && listing.status === "CanLoadMore" && (
            <Button
              variant="outline"
              className="md:col-span-2"
              onClick={() => listing.loadMore(30)}
            >
              Load more
            </Button>
          )}
          {!query && listing.status === "LoadingMore" && (
            <WorkingState className="md:col-span-2">
              Loading more listings
            </WorkingState>
          )}
        </section>
      )}

      <JobDrawer jobId={openJob} onClose={() => setOpenJob(null)} />
    </AppShell>
  )
}
