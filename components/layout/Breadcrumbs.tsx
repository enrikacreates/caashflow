'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

const SECTIONS: Record<string, string> = {
  periods: 'Budgets',
  cashflow: 'Caashflow',
  invoices: 'Caashflow',
  savings: 'Save Goals',
  'base-budget': 'Baseline',
  debts: 'Debt Demo',
  requests: 'Requests',
  settings: 'Settings',
}

/**
 * "You are here" on every page, and the way home while the header is slid away, so it
 * stays pinned as you scroll (see .chrome-pinned in globals.css). The layout renders it
 * everywhere; a detail page renders its own with `current` so it can name what's open.
 */
export default function Breadcrumbs({ current }: { current?: string }) {
  const [section, detail] = usePathname().split('/').filter(Boolean)
  // Detail pages supply their own, once they know the name
  if (detail && !current) return null
  const label = section ? (SECTIONS[section] ?? section) : null

  return (
    <nav aria-label="Breadcrumb" className="chrome-pinned sticky z-30 w-fit max-w-full mb-6">
      <ol className="flex items-center gap-1.5 bg-bg-white shadow-card rounded-full px-4 py-2 text-caption min-w-0">
        <li className="shrink-0">
          {label ? (
            <Link href="/" className="flex items-center gap-1.5 font-semibold text-primary hover:underline">
              <Home size={14} aria-hidden="true" /> Dashboard
            </Link>
          ) : (
            <span aria-current="page" className="flex items-center gap-1.5 font-semibold text-text-heading">
              <Home size={14} aria-hidden="true" /> Dashboard
            </span>
          )}
        </li>
        {label && (
          <>
            <li aria-hidden="true" className="shrink-0"><ChevronRight size={14} className="text-text-muted" /></li>
            <li className="shrink-0">
              {current ? (
                <Link href={`/${section}`} className="font-semibold text-primary hover:underline">{label}</Link>
              ) : (
                <span aria-current="page" className="font-semibold text-text-heading">{label}</span>
              )}
            </li>
          </>
        )}
        {current && (
          <>
            <li aria-hidden="true" className="shrink-0"><ChevronRight size={14} className="text-text-muted" /></li>
            <li aria-current="page" className="font-semibold text-text-heading truncate min-w-0">{current}</li>
          </>
        )}
      </ol>
    </nav>
  )
}
