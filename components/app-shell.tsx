"use client"

import {
  BookmarkIcon,
  BriefcaseIcon,
  FileTextIcon,
  GaugeIcon,
  LayoutGridIcon,
  ListOrderedIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ViewTransition } from "react"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { Wordmark } from "@/components/brand"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGridIcon },
  { href: "/matches", label: "Matches", icon: ListOrderedIcon },
  { href: "/jobs", label: "Jobs", icon: BriefcaseIcon },
  { href: "/tracker", label: "Tracker", icon: BookmarkIcon },
  { href: "/resume", label: "Resume", icon: FileTextIcon },
]

const SECONDARY = [
  { href: "/usage", label: "Usage", icon: GaugeIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const

function useActive() {
  const pathname = usePathname()
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The signed-in app frame: a sidebar on desktop, a top bar with scrolling
 * tabs on small screens, then the page title and content.
 */
export function AppShell({
  title,
  description,
  actions,
  children,
  wide = false,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  wide?: boolean
}) {
  const isActive = useActive()

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[248px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:ring-1 focus:ring-border"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh flex-col self-start border-r border-sidebar-border bg-sidebar px-3 py-4 lg:flex">
        <Link
          href="/dashboard"
          className="flex h-9 items-center rounded-lg px-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="mt-6 flex flex-col gap-0.5">
          {NAV.map((item) => (
            <SidebarLink
              key={item.href}
              {...item}
              active={isActive(item.href)}
            />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5">
          {SECONDARY.map((item) => (
            <SidebarLink
              key={item.href}
              {...item}
              active={isActive(item.href)}
            />
          ))}
          <SignOutButton />
          <div className="mt-3 flex items-center justify-between border-t border-sidebar-border px-2.5 pt-3">
            <span className="text-xs text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm lg:hidden">
          <div className="flex h-14 items-center justify-between gap-4 px-4">
            <Link href="/dashboard" className="outline-none">
              <Wordmark />
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <SignOutButton compact />
            </div>
          </div>
          <nav
            aria-label="Main"
            className="flex [scrollbar-width:none] gap-1 overflow-x-auto px-4 pb-2"
          >
            {[...NAV, ...SECONDARY].map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-8 shrink-0 items-center rounded-lg px-3 text-sm transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>

        <ViewTransition enter="page-enter" exit="page-exit" default="none">
          <main
            id="main"
            className={cn(
              "mx-auto flex w-full flex-1 flex-col gap-6 px-4 pt-6 pb-16 sm:px-8 sm:pt-10",
              wide ? "max-w-6xl" : "max-w-3xl"
            )}
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.025em]">
                  {title}
                </h1>
                {description && (
                  <div className="text-sm text-muted-foreground">
                    {description}
                  </div>
                )}
              </div>
              {actions}
            </div>
            <div className="flex flex-col gap-6">{children}</div>
          </main>
        </ViewTransition>
      </div>
    </div>
  )
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        active
          ? "bg-sidebar-accent font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-sidebar-border dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
      )}
    >
      <Icon
        className={cn("size-4", active && "text-foreground")}
        strokeWidth={1.5}
        aria-hidden
      />
      {label}
    </Link>
  )
}
