import {
  ArrowRightIcon,
  BookmarkIcon,
  FileCheck2Icon,
  LayoutGridIcon,
  LockIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { ViewTransition } from "react"

import { Wordmark } from "@/components/brand"
import { MatchDeck, SkillCheck } from "@/components/landing/deck"
import { Flow } from "@/components/landing/flow"
import { MatchScore } from "@/components/matches/match-score"
import { ThemeToggle } from "@/components/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { isAuthenticatedNextjs } from "@/lib/auth/server"
import { SOURCE_CREDITS } from "@/lib/jobs/credits"
import { cn } from "@/lib/utils"

const SOURCES = Object.values(SOURCE_CREDITS)

const PROOF: { icon: LucideIcon; label: string }[] = [
  { icon: FileCheck2Icon, label: "PDF or DOCX, scanned too" },
  { icon: SlidersHorizontalIcon, label: "You correct the skills" },
  { icon: Trash2Icon, label: "Delete everything anytime" },
]

const AFTER: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: LayoutGridIcon,
    title: "A dashboard that stays current",
    text: "Your summary, skills by category, strengths, gaps and top five matches in one place. Matches refresh when your skills change.",
  },
  {
    icon: SlidersHorizontalIcon,
    title: "Search every listing yourself",
    text: "Filter by internship or full-time, remote or on-site, location and posting date. Each listing opens with its match reason.",
  },
  {
    icon: BookmarkIcon,
    title: "Track what you applied to",
    text: "Save a job, mark it applied or hide it. Hidden jobs drop out of your matches and stay listed in case you change your mind.",
  },
]

const FAQ = [
  {
    q: "What can I upload?",
    a: "A PDF or DOCX up to 5 MB. Scanned PDFs work too: when there is no text layer, the AI reads the page images.",
  },
  {
    q: "Which AI reads my resume?",
    a: "Google Gemini and Groq. Your resume text goes to them to extract skills, and your skills and goals go to them to rank and explain matches. We don't log resume text.",
  },
  {
    q: "Where do the jobs come from?",
    a: `Public job boards: ${SOURCES.map((s) => s.name).join(", ")}. Listings refresh daily, and each one links back to and credits its source.`,
  },
  {
    q: "What if the AI gets a skill wrong?",
    a: "Change its level, remove it or add what's missing. Your corrected list is what matching uses, and you can reset to the AI result at any time.",
  },
  {
    q: "Can I delete my data?",
    a: "Yes. Settings deletes your account, resumes, analyses, preferences, matches and tracker in one step.",
  },
]

const H2 =
  "font-display text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-5xl"

export default async function Page() {
  const signedIn = await isAuthenticatedNextjs()
  const primary = signedIn
    ? { href: "/dashboard", label: "Open your dashboard" }
    : { href: "/sign-up", label: "Upload your resume" }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/" aria-label="CareerMatch AI home">
            <Wordmark />
          </Link>
          <nav
            aria-label="Sections"
            className="hidden items-center gap-1 text-sm text-muted-foreground md:flex"
          >
            {[
              ["#how", "How it works"],
              ["#matches", "Matches"],
              ["#faq", "Questions"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 transition-colors hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            {signedIn ? (
              <Link href="/dashboard" className={buttonVariants()}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="hidden h-9 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:flex"
                >
                  Sign in
                </Link>
                <Link href="/sign-up" className={buttonVariants()}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <ViewTransition enter="page-enter" exit="page-exit" default="none">
        <main className="flex flex-1 flex-col">
          {/* Hero */}
          <section className="overflow-hidden">
            <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8 lg:pt-20 lg:pb-24">
              <div className="flex flex-col gap-7 motion-safe:animate-rise">
                <h1 className="font-display text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4.25rem]">
                  Find the roles your resume{" "}
                  <span className="highlight">already fits</span>
                </h1>
                <p className="max-w-[32rem] text-lg leading-8 text-muted-foreground">
                  CareerMatch AI reads your resume, shows you every skill it
                  found and where, then ranks current internships and jobs by
                  how well they fit, with the reason for each
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={primary.href}
                    className={buttonVariants({ size: "lg" })}
                  >
                    {primary.label}
                    <ArrowRightIcon data-icon="inline-end" aria-hidden />
                  </Link>
                  <a
                    href="#how"
                    className={buttonVariants({ size: "lg", variant: "ghost" })}
                  >
                    See how it works
                  </a>
                </div>
                <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
                  {PROOF.map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-center gap-2">
                      <Icon className="size-4" strokeWidth={1.5} aria-hidden />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative [animation-delay:100ms] motion-safe:animate-rise">
                <Image
                  src="/brand/hero-stack.webp"
                  alt="A resume page with two highlighted lines linked to a ranked stack of job cards"
                  width={1109}
                  height={761}
                  priority
                  sizes="(min-width: 1024px) 640px, 100vw"
                  className="w-full select-none lg:scale-110"
                />
                <div className="absolute bottom-[-2%] left-0 flex w-72 items-center gap-3 rounded-xl border bg-card/95 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.10)] backdrop-blur-sm dark:shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      Frontend Engineering Intern
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      #1 · 3 of 4 skills
                    </span>
                  </div>
                  <MatchScore score={0.87} size="sm" />
                </div>
              </div>
            </div>
          </section>

          {/* Sources */}
          <section
            aria-label="Where listings come from"
            className="border-y bg-muted/40"
          >
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <p className="text-muted-foreground">
                Listings refreshed daily from {SOURCES.length} public job boards
              </p>
              <ul className="flex flex-wrap gap-x-6 gap-y-2">
                {SOURCES.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-display font-semibold tracking-[-0.01em] text-foreground/65 transition-colors hover:text-foreground"
                    >
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Flow */}
          <Section
            id="how"
            eyebrow="How it works"
            title="From one PDF to a ranked shortlist"
            lede="About a minute end to end. The AI does the reading and the comparing. You decide what counts as your skills."
          >
            <Flow />
          </Section>

          {/* You correct the AI */}
          <section className="border-y bg-muted/30">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 py-24 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-32">
              <div className="flex flex-col gap-6" data-reveal>
                <Eyebrow>Skill check</Eyebrow>
                <h2 className={H2}>
                  Every skill shows its source. You have the last word
                </h2>
                <p className="text-lg leading-8 text-muted-foreground">
                  Next to each skill is the line of your resume it came from, so
                  a wrong guess is easy to spot
                </p>
                <ul className="flex flex-col gap-3 text-sm leading-6">
                  {[
                    "Change a level from beginner to expert",
                    "Remove anything that isn't really yours",
                    "Add what the resume left out",
                    "Reset to the AI result whenever you like",
                  ].map((t) => (
                    <li key={t} className="flex gap-3">
                      <span
                        className="mt-2 h-1.5 w-3 shrink-0 rounded-full bg-mark ring-1 ring-brand/30"
                        aria-hidden
                      />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div
                data-reveal
                style={{ "--reveal-i": 2 } as React.CSSProperties}
              >
                <SkillCheck />
              </div>
            </div>
          </section>

          {/* Matches */}
          <section id="matches" className="scroll-mt-20">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 py-24 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-32">
              <div
                className="order-2 pt-24 lg:order-1"
                data-reveal
                style={{ "--reveal-i": 2 } as React.CSSProperties}
              >
                <MatchDeck />
              </div>
              <div
                className="order-1 flex flex-col gap-6 lg:order-2"
                data-reveal
              >
                <Eyebrow>Ranked matches</Eyebrow>
                <h2 className={H2}>
                  Every match says why it fits, and what it&apos;s missing
                </h2>
                <p className="text-lg leading-8 text-muted-foreground">
                  One score built from three parts you can see, a sentence on
                  why the role suits you, and the skills it asks for that you
                  don&apos;t have yet
                </p>
                <dl className="grid gap-4 border-t pt-6 sm:grid-cols-3">
                  {[
                    [
                      "Meaning",
                      "How close the listing reads to your experience",
                    ],
                    ["Skills", "How many of its skills you already have"],
                    ["Fit", "Role, job type and location against your goals"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <dt className="font-medium">{k}</dt>
                      <dd className="text-sm leading-6 text-muted-foreground">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>

          {/* After matching */}
          <Section
            eyebrow="After you match"
            title="Everything between a shortlist and your applications"
            className="border-t"
          >
            <ul className="grid gap-4 md:grid-cols-3">
              {AFTER.map(({ icon: Icon, title, text }, i) => (
                <li
                  key={title}
                  data-reveal
                  style={{ "--reveal-i": i } as React.CSSProperties}
                  className="flex flex-col gap-4 rounded-2xl border bg-card p-6 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-foreground/15 hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)]"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg border bg-background">
                    <Icon
                      className="size-4 text-muted-foreground"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-medium">{title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {/* Privacy */}
          <section
            aria-labelledby="privacy"
            className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-8"
          >
            <div
              data-reveal
              className="grid gap-6 rounded-2xl border bg-card p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12"
            >
              <div className="flex items-start gap-3">
                <LockIcon
                  className="mt-1.5 size-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <h2
                  id="privacy"
                  className="font-display text-2xl font-semibold tracking-[-0.02em]"
                >
                  About your data
                </h2>
              </div>
              <div className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
                <p>
                  To analyze your resume and explain matches, its text and your
                  skills are sent to AI providers, Google Gemini and Groq. We
                  don&apos;t log resume text.
                </p>
                <p>
                  You can delete your account and all of its data at any time
                  from Settings.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section
            id="faq"
            className="scroll-mt-20 border-t"
            aria-labelledby="faq-title"
          >
            <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-24 sm:px-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-20">
              <div className="flex flex-col gap-4" data-reveal>
                <Eyebrow>Questions</Eyebrow>
                <h2 id="faq-title" className={H2}>
                  Before you upload
                </h2>
              </div>
              <div
                className="flex flex-col divide-y border-y"
                data-reveal
                style={{ "--reveal-i": 1 } as React.CSSProperties}
              >
                {FAQ.map((f) => (
                  <details key={f.q} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span
                        className="relative size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      >
                        <span className="absolute top-1/2 left-0 h-px w-4 bg-current" />
                        <span className="absolute top-0 left-1/2 h-4 w-px bg-current transition-transform duration-200 ease-out group-open:scale-y-0" />
                      </span>
                    </summary>
                    <p className="max-w-prose pb-5 text-sm leading-6 text-muted-foreground">
                      {f.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* Final call to action */}
          <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-8">
            <div
              data-reveal
              className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-14 text-background sm:px-12 sm:py-20"
            >
              <div className="relative z-10 flex max-w-xl flex-col items-start gap-6">
                <h2 className={H2}>Start with the resume you already have</h2>
                <p className="text-lg leading-8 text-background/70">
                  Upload it, check the skills, and see your ranked shortlist in
                  about a minute
                </p>
                <Link
                  href={primary.href}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-background text-foreground hover:bg-background/90"
                  )}
                >
                  {primary.label}
                  <ArrowRightIcon data-icon="inline-end" aria-hidden />
                </Link>
              </div>
              <Image
                src="/brand/hero-stack.webp"
                alt=""
                width={1109}
                height={761}
                sizes="520px"
                className="pointer-events-none absolute -right-20 -bottom-20 hidden w-[520px] rotate-[-6deg] md:block"
              />
            </div>
          </section>
        </main>
      </ViewTransition>

      <footer className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 text-sm sm:px-8 md:grid-cols-[2fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Wordmark />
            <p className="max-w-xs text-muted-foreground">
              Resume analysis and ranked internships and jobs for students
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              ["/sign-up", "Create an account"],
              ["/sign-in", "Sign in"],
              ["#how", "How it works"],
              ["#faq", "Questions"],
            ]}
          />
          <FooterCol
            title="Listings from"
            links={SOURCES.map((s) => [s.url, s.name])}
            external
          />
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 border-t px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-8">
          <span>CareerMatch AI</span>
          <span>Each listing links back to and credits its source</span>
        </div>
      </footer>
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-brand">
      <span className="h-px w-6 bg-current" aria-hidden />
      {children}
    </p>
  )
}

function Section({
  id,
  eyebrow,
  title,
  lede,
  className,
  children,
}: {
  id?: string
  eyebrow: string
  title: string
  lede?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className={cn("scroll-mt-20", className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-24 sm:px-8 lg:py-32">
        <div className="flex max-w-2xl flex-col gap-4" data-reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className={H2}>{title}</h2>
          {lede && (
            <p className="text-lg leading-8 text-muted-foreground">{lede}</p>
          )}
        </div>
        <div data-reveal style={{ "--reveal-i": 1 } as React.CSSProperties}>
          {children}
        </div>
      </div>
    </section>
  )
}

function FooterCol({
  title,
  links,
  external = false,
}: {
  title: string
  links: string[][]
  external?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-medium">{title}</p>
      <ul className="flex flex-col gap-2 text-muted-foreground">
        {links.map(([href, label]) => (
          <li key={href}>
            {external ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {label}
              </a>
            ) : (
              <Link
                href={href}
                className="transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
