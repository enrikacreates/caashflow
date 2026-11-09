'use client'

import { useEffect, type RefObject } from 'react'

// Matches the main column's md:pl-[220px]: the floating nav card lives left of this
const NAV_COLUMN_WIDTH = 220
const NAV_COLUMN_BREAKPOINT = '(min-width: 768px)'
// Ignore tiny scroll jitter (trackpad settle, mobile rubber-banding)
const SCROLL_THRESHOLD = 8
// A short beat before sliding away, so crossing the workspace on the way to the nav doesn't flicker
const HIDE_DELAY_MS = 120

/**
 * Slides the header up and the footer art down (via data-chrome on `rootRef`, see
 * globals.css) while the mouse is in the workspace or the page is scrolling down.
 * They come back when the mouse leaves the workspace, on scroll up, and at either
 * end of the page. Writes the attribute directly so mouse moves never re-render
 * the layout. Header and footer heights are read with offsetHeight, which ignores
 * the slide, so the reveal zones stay put while they're hidden.
 */
export function useAutoHideChrome(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const header = root.querySelector('header')
    const footer = root.querySelector('footer')
    const navColumn = window.matchMedia(NAV_COLUMN_BREAKPOINT)

    let pointerInWorkspace = false
    let scrolledAway = false
    let lastY = window.scrollY
    let hideTimer: ReturnType<typeof setTimeout> | undefined

    const apply = () => {
      clearTimeout(hideTimer)
      if (pointerInWorkspace || scrolledAway) {
        if (root.dataset.chrome === 'hidden') return
        hideTimer = setTimeout(() => { root.dataset.chrome = 'hidden' }, HIDE_DELAY_MS)
      } else {
        delete root.dataset.chrome
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const left = navColumn.matches ? NAV_COLUMN_WIDTH : 0
      const top = header?.offsetHeight ?? 0
      const bottom = window.innerHeight - (footer?.offsetHeight ?? 0)
      pointerInWorkspace = e.clientX >= left && e.clientY >= top && e.clientY <= bottom
      // Heading for the nav or footer is a clear ask to see them, even after scrolling down
      if (!pointerInWorkspace) scrolledAway = false
      apply()
    }

    const onPointerLeavePage = () => {
      pointerInWorkspace = false
      scrolledAway = false
      apply()
    }

    const onScroll = () => {
      const y = window.scrollY
      const atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - SCROLL_THRESHOLD
      if (y <= 0 || atEnd) scrolledAway = false
      else if (y - lastY > SCROLL_THRESHOLD) scrolledAway = true
      else if (lastY - y > SCROLL_THRESHOLD) scrolledAway = false
      else return
      lastY = y
      apply()
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    document.documentElement.addEventListener('mouseleave', onPointerLeavePage)
    return () => {
      clearTimeout(hideTimer)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
      document.documentElement.removeEventListener('mouseleave', onPointerLeavePage)
      delete root.dataset.chrome
    }
  }, [rootRef])
}
