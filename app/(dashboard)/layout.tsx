'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, Settings2, LogOut } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import HeaderAvatar from '@/components/layout/HeaderAvatar'
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

        {/* Right side: profile blob + settings */}
        <div className="flex items-center gap-3">
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
          Big transparent CAA$H watermark + the logo, with playful shapes peeking from the band edges. */}
      <footer className="relative w-full mt-10 overflow-hidden bg-primary-teal">
        {/* Playful shapes — sit on top of the band, peeking in from the edges (clipped by overflow) */}
        <img
          src="/shapes/blob-orange.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute -top-10 left-[18%] w-28 md:w-40 -rotate-12 opacity-95"
        />
        <img
          src="/shapes/circle-gold.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute top-3 right-[26%] w-12 md:w-16 opacity-90"
        />
        <img
          src="/shapes/blob-pink.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute -top-12 -right-10 w-36 md:w-48 -rotate-6 opacity-90"
        />
        <img
          src="/shapes/bluelinewaves.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute bottom-3 right-[6%] w-20 md:w-28 opacity-60"
        />

        {/* CAA$H watermark — large, faint, behind the content */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="font-display leading-none text-white/10 text-[7rem] md:text-[12rem]">CAA$H</span>
        </div>

        {/* Band — fixed, compact height; logo bottom-left, whitened to read on teal */}
        <div className="relative h-44 md:h-52">
          <img
            src="/logo.svg"
            alt="Caashflow"
            className="pointer-events-none select-none absolute left-[5%] bottom-[18%] w-[26%] max-w-[220px] h-auto brightness-0 invert"
          />
        </div>
      </footer>
    </div>
  )
}
