'use client'

import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 md:hidden bg-white border border-line rounded-[12px] w-10 h-10 flex items-center justify-center"
      >
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
          <path d="M1 1h16M1 7h16M1 13h16" stroke="#111" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      <main className="md:ml-[250px] p-6 md:p-8">
        {children}
      </main>
    </div>
  )
}
