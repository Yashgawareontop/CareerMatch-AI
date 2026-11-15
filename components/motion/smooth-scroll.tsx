"use client"

import Lenis from "lenis"
import "lenis/dist/lenis.css"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

/**
 * Inertial page scrolling (Lenis). Off when the user prefers reduced motion,
 * and never applied inside dialogs, drawers or nested scroll areas.
 */
export function SmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (reduce.matches) return

    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
      wheelMultiplier: 1,
      allowNestedScroll: true,
      anchors: { offset: -80 },
      prevent: (node) =>
        node instanceof Element &&
        !!node.closest('[role="dialog"], [data-lenis-prevent]'),
    })
    lenisRef.current = lenis
    return () => {
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  // A new route starts at the top, without a smooth scroll back up.
  useEffect(() => {
    lenisRef.current?.scrollTo(0, { immediate: true, force: true })
  }, [pathname])

  return null
}
