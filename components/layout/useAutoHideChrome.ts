'use client'

import { useEffect, type RefObject } from 'react'

// Matches the main column's md:pl-[220px]: the floating nav card lives left of this
const NAV_COLUMN_WIDTH = 220
const NAV_COLUMN_BREAKPOINT = '(min-width: 768px)'
// Ignore tiny scroll jitter (trackpad settle, mobile rubber-banding)
const SCROLL_THRESHOLD = 8
// A short beat before sliding away, so crossing the workspace on the way to the nav doesn't flicker
const HIDE_DELAY_MS = 120

const STORAGE_KEY = 'caashflow:chrome-away'

/** Bring the logo and footer art back for the next login. */
export function resetChromeAway() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* private mode: nothing was saved */ }
}

/** Runs before first paint (see the layout), so a reload doesn't flash the logo and footer. */
export const RESTORE_CHROME_SCRIPT = `try{if(sessionStorage.getItem('${STORAGE_KEY}'))document.currentScript.parentElement.dataset.chrome='hidden'}catch(e){}`

/**
 * The logo and footer art greet you after login, then slide away (via data-chrome on
 * `rootRef`, see globals.css) the first time the mouse enters the workspace or the page
 * scrolls down. They stay away for the rest of the session: the breadcrumb bar and sidebar
 * carry navigation from there. Writes the attribute directly so mouse moves never re-render.
 */
export function useAutoHideChrome(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || root.dataset.chrome === 'hidden') return
    const header = root.querySelector('header')
    const footer = root.querySelector('footer')
    const navColumn = window.matchMedia(NAV_COLUMN_BREAKPOINT)

    let lastY = window.scrollY
    let hideTimer: ReturnType<typeof setTimeout> | undefined

    const stopListening = () => {
      clearTimeout(hideTimer)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
    }

    const slideAway = () => {
      root.dataset.chrome = 'hidden'
      try { sessionStorage.setItem(STORAGE_KEY, '1') } catch { /* private mode: returns next page load */ }
      stopListening()
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const left = navColumn.matches ? NAV_COLUMN_WIDTH : 0
      const top = header?.offsetHeight ?? 0
      const bottom = window.innerHeight - (footer?.offsetHeight ?? 0)
      const inWorkspace = e.clientX >= left && e.clientY >= top && e.clientY <= bottom
      clearTimeout(hideTimer)
      if (inWorkspace) hideTimer = setTimeout(slideAway, HIDE_DELAY_MS)
    }

    const onScroll = () => {
      const y = window.scrollY
      if (y - lastY > SCROLL_THRESHOLD) slideAway()
      else if (lastY - y > SCROLL_THRESHOLD) lastY = y
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return stopListening
  }, [rootRef])
}
