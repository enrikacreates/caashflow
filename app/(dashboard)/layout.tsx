'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'

/* -------------------------------------------------------
 * DASHBOARD LAYOUT
 *
 * Wraps all protected routes with:
 *   - Persistent left sidebar (desktop)
 *   - Slide-in sidebar + backdrop (mobile)
 *   - Hamburger trigger (mobile, top-left)
 *   - Main content area with correct left margin on desktop
 *
 * All protected routes live under app/(dashboard)/ and
 * automatically inherit this layout.
 * ------------------------------------------------------- */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg-cream">
      {/* Sidebar — always rendered, visibility controlled via CSS transform */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile hamburger — fixed top-left, hidden on desktop */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="
          fixed top-4 left-4 z-30 md:hidden
          bg-bg-white border border-border rounded-sm
          w-10 h-10 flex items-center justify-center
          text-text hover:bg-surface-beige
          transition-colors duration-150
        "
        aria-label="Open navigation"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {/* Main content — offset by sidebar width on desktop */}
      <main className="md:ml-[260px] p-6 md:p-8">
        {children}
      </main>
    </div>
  )
}
