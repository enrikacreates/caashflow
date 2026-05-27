'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, Settings2, LogOut } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import HeaderAvatar from '@/components/layout/HeaderAvatar'
import HeaderStats from '@/components/layout/HeaderStats'
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

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col">
      {/* ── Header band — off-white bg ────────────────── */}
      <header className="sticky top-0 z-30 bg-white flex items-center justify-between px-6 md:px-10 h-[72px] md:h-[84px]">
        {/* Big logo */}
        <Link href="/" className="hover:opacity-80 transition-opacity shrink-0">
          <img src="/logo.svg" alt="Caashflow" className="h-11 md:h-12 w-auto" />
        </Link>

        {/* YTD stat blobs — center, large screens only */}
        <HeaderStats className="hidden lg:flex" />

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
          <form action={signOut}>
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
          fixed top-4 left-4 z-30 md:hidden
          bg-white border border-border rounded-2xl
          w-10 h-10 flex items-center justify-center
          text-text hover:bg-surface-beige
          transition-colors duration-150 shadow-sm
        "
        aria-label="Open navigation"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {/* Floating nav card */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content — offset for floating nav on desktop; grows to push footer flush to bottom */}
      <main className="flex-1 px-6 pt-10 pb-[230px] md:pl-[220px] md:pr-10 md:pt-14 md:pb-[270px]">
        <div className="max-w-3xl mx-auto">
          {children}
        </div>
      </main>

      {/* Footer — full-bleed teal band, flush to the very bottom (nothing beneath it).
          Shapes perch on the band's TOP edge (mostly above it, base dipping in); the band itself
          holds the big transparent CAA$H watermark + the logo. */}
      <div className="sticky bottom-0 z-20 w-full">
        {/* Footer shapes — full-width organic composition; rendered BEHIND the band (no z bump,
            band paints on top) and dropped down so the bases tuck behind the teal. */}
        <img
          src="/shapes/navshapes/footershapes2.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute left-0 bottom-full w-full translate-y-[8%]"
        />

        {/* The band — full-bleed teal, fixed compact height; overflow-hidden clips the watermark + surface accents */}
        <footer className="relative w-full overflow-hidden bg-primary-teal">
          {/* CAA$H watermark — oversized live text that fills the banner width and scales with the
              window (vw units); clipped top/bottom by the band like the FLOW watermark. */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span className="font-display leading-none whitespace-nowrap text-white/10 text-[30vw]">CAA$H</span>
          </div>

          <div className="relative h-28 md:h-32">
            <img
              src="/logo-footer.svg"
              alt="Caashflow"
              className="pointer-events-none select-none absolute left-[5%] bottom-[20%] w-[26%] max-w-[220px] h-auto"
            />
          </div>
        </footer>
      </div>
    </div>
  )
}
