'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import TipOfTheDay from '@/components/dashboard/TipOfTheDay'

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
 * "You are here" on every page, in a cream bar pinned to the top that content scrolls behind.
 * Once the header slides away for the session, this is the way home. The layout renders it
 * everywhere; a detail page renders its own with `current` to name what's open.
 */
export default function Breadcrumbs({ current }: { current?: string }) {
  const [section, detail] = usePathname().split('/').filter(Boolean)
  // Detail pages supply their own, once they know the name
  if (detail && !current) return null
  const label = section ? (SECTIONS[section] ?? section) : null

  return (
    <div className="sticky top-0 z-20 -mx-3 pl-3 pr-14 md:pr-3 pt-3 pb-2 mb-4 bg-bg-cream flex items-center justify-between gap-4">
    <nav aria-label="Breadcrumb" className="max-w-full min-w-0 sm:shrink-0">
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
    {!section && <TipOfTheDay className="hidden sm:flex justify-end text-right min-w-0" />}
    </div>
  )
}
