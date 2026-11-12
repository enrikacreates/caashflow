'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Menu, Settings2, LogOut } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import HeaderAvatar from '@/components/layout/HeaderAvatar'
import HeaderStats from '@/components/layout/HeaderStats'
import ToastHost from '@/components/ui/ToastHost'
import RoundUpPill from '@/components/ui/RoundUpPill'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { RESTORE_CHROME_SCRIPT, resetChromeAway, useAutoHideChrome } from '@/components/layout/useAutoHideChrome'
import { signOut } from '@/app/actions/auth'

/* -------------------------------------------------------
 * DASHBOARD LAYOUT
 *
 * New structure:
 *   - Top header: big logo (left) + profile blob (right)
 *   - Floating nav card (left, below header)
 *   - Main content area
 * ------------------------------------------------------- */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useAutoHideChrome(rootRef)

  return (
    <div ref={rootRef} suppressHydrationWarning className="min-h-screen bg-bg-cream flex flex-col overflow-clip">
      <script dangerouslySetInnerHTML={{ __html: RESTORE_CHROME_SCRIPT }} />
      {/* ── Header band — off-white bg ────────────────── */}
      <header className="chrome-top sticky top-0 z-30 bg-white flex items-center justify-between px-6 md:px-10 h-[72px] md:h-[84px]">
        {/* Big logo */}
        <Link href="/" className="hover:opacity-80 transition-opacity shrink-0">
          <img src="/logo.svg" alt="Caashflow" className="h-11 md:h-12 w-auto" />
        </Link>

        {/* YTD stat blobs — pushed toward the profile side, large screens only */}
        <HeaderStats className="hidden lg:flex lg:ml-auto lg:mr-4" />

        {/* Right side: profile blob + settings */}
        <div className="flex items-center gap-3">
          {/* Camp dash divider — playful break between the YTD stats and the controls */}
          <img
            src="/shapes/navshapes/campDashDivider3.svg"
            alt=""
            aria-hidden="true"
            className="hidden lg:block h-12 w-[7px] mr-2 select-none pointer-events-none"
          />
          {/* Settings icon */}
          <Link
            href="/settings"
            className="text-text-muted hover:text-text-heading transition-colors p-1"
            aria-label="Settings"
          >
            <Settings2 size={20} />
          </Link>

          {/* Sign out */}
          <form action={signOut} onSubmit={resetChromeAway}>
            <button
              type="submit"
              className="text-text-muted hover:text-text-heading transition-colors p-1"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </form>

          {/* Profile avatar with colored blob — links to settings */}
          <HeaderAvatar />
        </div>

        {/* Irregular wavy bottom edge — same white fill, hangs below so content scrolls under it */}
        <svg
          aria-hidden="true"
          className="absolute top-full left-0 w-full h-4 text-white drop-shadow-[0_3px_2px_rgba(0,0,0,0.06)]"
          viewBox="0 0 1440 24"
          preserveAspectRatio="none"
          fill="currentColor"
        >
          <path d="M0,0 H1440 V20 Q1080,13 720,18 Q360,13 0,20 Z" />
        </svg>
      </header>

      {/* Mobile hamburger — below header */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="
          chrome-menu fixed top-4 left-4 z-30 md:hidden
          bg-white border border-border rounded-2xl
          w-10 h-10 flex items-center justify-center
          text-text hover:bg-surface-beige
          transition-colors duration-150 shadow-sm
        "
        aria-label="Open navigation"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {/* The mark takes over from the big logo once it's slid away. Phones have the breadcrumb. */}
      <Link
        href="/"
        aria-label="Caashflow home"
        title="Home"
        className="chrome-mark fixed top-3 left-6 z-30 w-10 h-10 items-center justify-center rounded-full bg-white shadow-card"
      >
        <svg viewBox="4 7 24 18" className="w-6 h-6 text-income" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 11 q2.5 -2.4 5 0 t5 0 t5 0 t5 0" />
          <path d="M6 16 q2.5 -2.4 5 0 t5 0 t5 0 t5 0" />
          <path d="M6 21 q2.5 -2.4 5 0 t5 0 t5 0 t5 0" />
        </svg>
      </Link>

      {/* Floating nav card */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content — offset for floating nav on desktop; grows to push footer flush to bottom */}
      <main className="chrome-main flex-1 px-6 pt-10 pb-[136px] md:pl-[220px] md:pr-10 md:pt-14 md:pb-[152px]">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs />
          {children}
        </div>
      </main>

      {/* Footer — full-bleed teal band, flush to the very bottom (nothing beneath it).
          Shapes perch on the band's TOP edge (mostly above it, base dipping in); the band itself
          holds the big transparent CAA$H watermark + the logo. */}
      <div className="footer-art chrome-bottom sticky bottom-0 z-20 w-full">
        {/* Colored backdrop behind the right-side wave stripes (same viewBox/positioning as the
            shapes so it tracks them on resize) — keeps the stripes visible over scrolling content. */}
        <img
          src="/shapes/navshapes/footer-wave-backdrop.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute left-0 bottom-full w-full translate-y-[30%]"
        />
        {/* Footer shapes — full-width organic composition; rendered BEHIND the band (no z bump,
            band paints on top) and dropped down so the bases tuck behind the teal. */}
        <img
          src="/shapes/navshapes/footershapes2.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute left-0 bottom-full w-full translate-y-[30%]"
        />
        {/* Red dashed wavy accent — rendered BEHIND the band so its ends tuck behind the green */}
        <img
          src="/shapes/navshapes/footer-dash-wave.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute left-0 bottom-full w-full translate-y-[30%]"
        />

        {/* The band — full-bleed teal, fixed compact height; overflow-hidden clips the watermark + surface accents */}
        {/* Organic wavy top edge — a teal wave whose straight bottom overlaps INTO the band (no gap)
            and whose wavy top rises to meet the shapes. Behind the shapes so they sit on top. */}
        <svg
          aria-hidden="true"
          className="absolute z-0 left-0 bottom-full -mb-[2px] w-full h-5 text-primary-teal"
          viewBox="0 0 1440 28"
          preserveAspectRatio="none"
          fill="currentColor"
        >
          <path d="M0,28 H1440 V10 Q1080,17 720,12 Q360,17 0,10 Z" />
        </svg>

        <footer className="relative w-full overflow-hidden bg-primary-teal">
          {/* CAA$H watermark — oversized live text that fills the banner width and scales with the
              window (vw units); clipped top/bottom by the band like the FLOW watermark. */}
          <div className="absolute inset-0 flex items-start justify-center pointer-events-none select-none">
            <span className="font-display leading-none whitespace-nowrap text-white/10 text-[32vw]">CAA$H</span>
          </div>

          <div className="relative h-9 md:h-10">
            <img
              src="/logo-footer.svg"
              alt="Caashflow"
              className="pointer-events-none select-none absolute left-[5%] top-1/2 -translate-y-1/2 h-7 md:h-8 w-auto"
            />
          </div>
        </footer>
      </div>
      <ToastHost />
      <RoundUpPill />
    </div>
  )
}
