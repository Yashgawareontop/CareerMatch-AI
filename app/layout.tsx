import type { Metadata } from "next"
import { headers } from "next/headers"
import {
  Bricolage_Grotesque,
  Geist_Mono,
  Instrument_Sans,
} from "next/font/google"

import "./globals.css"
import { RevealObserver } from "@/components/motion/reveal-observer"
import { SmoothScroll } from "@/components/motion/smooth-scroll"
import { ThemeProvider } from "@/components/theme-provider"
import { ConvexAuthNextjsServerProvider } from "@/lib/auth/server"
import { cn } from "@/lib/utils"

const fontSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
})

// Brand and headline face. Variable, so weight and optical size are free.
const fontDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "wdth"],
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "CareerMatch AI",
  description:
    "Upload your resume, check the skills we find, and get current internships and jobs ranked for you, with the reason each one fits.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Set by proxy.ts for the Content Security Policy; the theme script is
  // inline, so it needs it to run.
  const nonce = (await headers()).get("x-nonce") ?? undefined
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontSans.variable,
        fontDisplay.variable,
        fontMono.variable
      )}
    >
      <body>
        <ConvexAuthNextjsServerProvider>
          <ThemeProvider nonce={nonce}>
            <SmoothScroll />
            <RevealObserver />
            {children}
          </ThemeProvider>
        </ConvexAuthNextjsServerProvider>
      </body>
    </html>
  )
}
