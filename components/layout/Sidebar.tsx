'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import {
  Calendar,
  Layers,
  Hammer,
  PiggyBank,
  ListPlus,
  BarChart2,
  Settings2,
  LogOut,
  X,
} from 'lucide-react'

/* -------------------------------------------------------
 * NAV STRUCTURE
 * Each item maps a route to a label + Lucide icon.
 * To rename a label: just update `name` here.
 * To reorder sections: rearrange the objects.
 * ------------------------------------------------------- */
const NAV_ITEMS = [
  {
    label: 'Main',
    items: [
      { name: 'Budgets',  href: '/periods',     icon: Calendar,  color: '#ffcbcd' }, // soft pink
    ],
  },
  {
    label: 'Planning',
    items: [
      { name: 'DebtDemo', href: '/debts',        icon: Hammer,    color: '#ffac97' }, // coral
      { name: 'SaveUp',   href: '/savings',      icon: PiggyBank, color: '#ffd34f' }, // yellow
      { name: 'NextBuys', href: '/requests',     icon: ListPlus,  color: '#dbd4f7' }, // lavender
      { name: 'Caash',    href: '/cashflow',     icon: BarChart2, color: '#b7f0f4' }, // mint
    ],
  },
  {
    label: 'Account',
    items: [
      { name: 'Baseline', href: '/base-budget',  icon: Layers,    color: '#e0cea2' }, // warm tan
      { name: 'Settings', href: '/settings',     icon: Settings2, color: '#bde7b5' }, // lime green
    ],
  },
]

/* -------------------------------------------------------
 * SIDEBAR COMPONENT
 *
 * Props:
 *   open     — controlled by parent (DashboardLayout)
 *   onClose  — called when overlay or X is tapped
 *
 * Behaviour:
 *   - Desktop (md+): always visible, translated into view
 *   - Mobile:        hidden by default, slides in when `open`
 *   - Overlay click or X button closes on mobile
 * ------------------------------------------------------- */
export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()

  /* Exact match for root, prefix match for everything else */
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      {/* ── Mobile overlay ────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ─────────────────────────────────── */}
      <aside
        className={`
          fixed left-0 top-0 h-screen w-[260px]
          bg-bg-cream
          flex flex-col z-50
          transition-transform duration-200
          md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Dashed separator — floats between logo and sign-out, doesn't touch top or bottom */}
        <div
          className="absolute right-0 pointer-events-none"
          style={{
            top: '84px',
            bottom: '76px',
            borderRight: '2px dashed #ED6113',
          }}
        />
        {/* ── Logo ────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-divider shrink-0">
          <Link href="/" onClick={onClose} className="hover:opacity-80 transition-opacity">
            <span className="font-display text-[22px] leading-none text-text-heading">
              CAA$HFLOW
            </span>
            <p className="text-[11px] text-text-muted uppercase tracking-widest font-semibold mt-1">
              Budget System
            </p>
          </Link>

          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="md:hidden text-text-muted hover:text-text transition-colors p-1 rounded-sm"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Nav sections ────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {NAV_ITEMS.map((section) => (
            <div key={section.label}>
              {/* Section heading */}
              <p className="text-[11px] uppercase text-text-muted font-bold tracking-wider px-3 mb-1">
                {section.label}
              </p>

              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-full
                          text-sm font-semibold uppercase tracking-wider
                          transition-all duration-150
                          ${active
                            ? 'text-black shadow-sm'
                            : 'bg-bg-white text-text-muted shadow-sm hover:text-text-heading hover:shadow-md'
                          }
                        `}
                        style={active ? { backgroundColor: item.color } : undefined}
                      >
                        <Icon
                          size={26}
                          strokeWidth={1.75}
                          className={active ? 'text-black' : 'text-text-muted'}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Sign out ─────────────────────────────────────── */}
        <div className="shrink-0 px-4 pb-6 pt-4 border-t border-divider">
          <form action={signOut}>
            <button
              type="submit"
              className="
                flex items-center gap-3 w-full px-3 py-2.5 rounded-sm
                text-sm font-medium text-text-muted
                hover:bg-surface-beige hover:text-text
                transition-all duration-150
              "
            >
              <LogOut size={17} aria-hidden="true" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
