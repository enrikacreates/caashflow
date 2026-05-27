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
      <header className="bg-white/60 flex items-center justify-between px-6 py-4 md:px-10 md:py-5">
        {/* Big logo */}
        <Link href="/" className="hover:opacity-80 transition-opacity shrink-0">
          <img src="/logo.svg" alt="Caashflow" className="h-14 md:h-16 w-auto" />
        </Link>

        {/* YTD stat blobs — center, large screens only */}
        <HeaderStats className="hidden lg:flex" />

        {/* Right side: profile blob + settings */}
        <div className="flex items-center gap-3">
          {/* Camp dash divider — playful break between the YTD stats and the controls */}
          <img
            src="/shapes/navshapes/campDashDivider.svg"
            alt=""
            aria-hidden="true"
            className="hidden lg:block h-12 w-[12px] mr-1 select-none pointer-events-none"
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
      <main className="flex-1 px-6 py-6 md:pl-[220px] md:pr-10 md:py-6">
        <div className="max-w-3xl mx-auto">
          {children}
        </div>
      </main>

      {/* Footer — full-bleed teal band, flush to the very bottom (nothing beneath it).
          Shapes perch on the band's TOP edge (mostly above it, base dipping in); the band itself
          holds the big transparent CAA$H watermark + the logo. */}
      <div className="relative w-full mt-20">
        {/* Perched shapes — rest ON TOP of the band, bottoms sitting right on its top edge
            (bottom-full, no downward nudge) so the green never contains them. Width-only sizing
            preserves each shape's natural aspect (no skew). Rendered outside the band so they aren't clipped. */}
        <img
          src="/shapes/sail-blue.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute z-10 left-[40%] -translate-x-1/2 bottom-full w-40 md:w-52"
        />
        <img
          src="/shapes/blob-peach.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute z-10 left-[9%] bottom-full w-16 md:w-24"
        />
        <img
          src="/shapes/circle-gold.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute z-10 left-[3%] bottom-full w-9 md:w-12"
        />
        <img
          src="/shapes/rect-pink.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute z-10 left-[20%] bottom-full w-24 md:w-36"
        />

        {/* The band — full-bleed teal, fixed compact height; overflow-hidden clips the watermark + surface accents */}
        <footer className="relative w-full overflow-hidden bg-primary-teal">
          {/* CAA$H watermark — oversized live text that fills the banner width and scales with the
              window (vw units); clipped top/bottom by the band like the FLOW watermark. */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span className="font-display leading-none whitespace-nowrap text-white/10 text-[40vw]">CAA$H</span>
          </div>

          <div className="relative h-40 md:h-44">
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
