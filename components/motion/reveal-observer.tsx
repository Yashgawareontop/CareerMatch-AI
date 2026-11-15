"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

/**
 * Reveals `[data-reveal]` elements as they scroll into view: a short fade
 * and rise, staggered with `--reveal-i`. The hidden state only applies once
 * this runs (it sets `.reveal-ready` on <html>), so without JavaScript
 * everything is simply visible.
 */
export function RevealObserver() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    root.classList.add("reveal-ready")

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          el.setAttribute("data-revealed", "")
          observer.unobserve(el)
          // Once in place, hand the element back to its own transitions so
          // hovers stay quick instead of inheriting the slow reveal.
          const i = Number(el.style.getPropertyValue("--reveal-i")) || 0
          window.setTimeout(
            () => el.removeAttribute("data-reveal"),
            1000 + i * 70
          )
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    )

    const observeAll = () =>
      document
        .querySelectorAll("[data-reveal]:not([data-revealed])")
        .forEach((el) => observer.observe(el))
    observeAll()

    // Content that renders later, like a query resolving, joins in too.
    const mutations = new MutationObserver(observeAll)
    mutations.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutations.disconnect()
    }
  }, [pathname])

  return null
}
