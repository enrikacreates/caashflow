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
    <div className="min-h-screen bg-bg-cream">
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

      {/* Main content — offset for floating nav on desktop */}
      <main className="px-6 py-6 md:pl-[220px] md:pr-10 md:py-6">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
