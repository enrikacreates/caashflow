'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  Layers,
  Hammer,
  PiggyBank,
  ListPlus,
  BarChart2,
  X,
  Settings2,
  LogOut,
  PanelLeftClose,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { resetChromeAway } from '@/components/layout/useAutoHideChrome'
import HouseRules from '@/components/layout/HouseRules'

/* -------------------------------------------------------
 * NAV ITEMS — flat list, no sections
 * ------------------------------------------------------- */
const NAV_ITEMS = [
  { name: 'Budgets',    href: '/periods',     icon: Calendar  },
  { name: 'Caashflow',  href: '/cashflow',    icon: BarChart2 },
  { name: 'Save Goals', href: '/savings',     icon: PiggyBank },
  { name: 'Baseline',   href: '/base-budget', icon: Layers    },
  { name: 'Debt Demo',  href: '/debts',       icon: Hammer    },
  { name: 'Requests',   href: '/requests',    icon: ListPlus  },
]

/* -------------------------------------------------------
 * FLOATING NAV — soft curved white card
 * ------------------------------------------------------- */
export default function Sidebar({
  open,
  onClose,
  onHide,
}: {
  open: boolean
  onClose: () => void
  // Desktop: tuck the menu and House Rules away for more room
  onHide?: () => void
}) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      {/* ── Mobile overlay ──────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Floating nav card + House Rules ──────────────────
          Phones: one slide-in white panel holding both.
          Desktop: two separate cards on the ground, the rules under the menu. */}
      <div
        className={`
          chrome-side fixed z-50 flex flex-col gap-4
          transition-all duration-200

          /* Mobile: full slide-in panel */
          top-0 left-0 h-screen w-[220px] overflow-y-auto
          bg-white rounded-r-3xl shadow-md

          /* Desktop: floating cards below the header */
          md:top-[120px] md:left-6 md:h-auto md:w-max
          md:max-h-[calc(100vh-140px)]
          md:bg-transparent md:shadow-none md:rounded-none

          md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
      <nav className="relative px-2 py-3 md:bg-white md:rounded-3xl md:shadow-md">
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            aria-label="Hide menu"
            title="Hide menu for more room"
            className="hidden md:flex absolute -bottom-3.5 right-3 z-10 w-7 h-7 items-center justify-center rounded-full bg-white shadow-card text-text-muted hover:text-text-heading transition-colors"
          >
            <PanelLeftClose size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
        {/* Mobile close button */}
        <div className="flex justify-end px-2 pb-2 md:hidden">
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text transition-colors p-1 rounded-sm"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`
                    flex items-center justify-between gap-4 px-4 py-2 rounded-2xl
                    text-[13px] font-bold uppercase tracking-wider
                    transition-all duration-150
                    ${active
                      ? 'text-text-heading'
                      : 'text-text-muted hover:text-text-heading hover:bg-surface-beige/50'
                    }
                  `}
                >
                  {item.name}
                  <Icon
                    size={18}
                    strokeWidth={1.75}
                    className={active ? 'text-text-heading' : 'text-text-muted/60'}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Always reachable, since the header with its own links slides away while working */}
        <ul className="space-y-0.5 mt-2 pt-2 border-t border-divider">
          <li>
            <Link href="/settings" onClick={onClose} className="flex items-center justify-between gap-4 px-4 py-2 rounded-2xl text-[13px] font-bold uppercase tracking-wider transition-all duration-150 text-text-muted hover:text-text-heading hover:bg-surface-beige/50">
              Settings
              <Settings2 size={18} strokeWidth={1.75} className="text-text-muted/60" aria-hidden="true" />
            </Link>
          </li>
          <li>
            <form action={signOut} onSubmit={resetChromeAway}>
              <button type="submit" className="w-full flex items-center justify-between gap-4 px-4 py-2 rounded-2xl text-[13px] font-bold uppercase tracking-wider transition-all duration-150 text-text-muted hover:text-text-heading hover:bg-surface-beige/50">
                Sign out
                <LogOut size={18} strokeWidth={1.75} className="text-text-muted/60" aria-hidden="true" />
              </button>
            </form>
          </li>
        </ul>
      </nav>
      <HouseRules className="px-2 pb-4 border-t border-divider pt-3 mx-2 md:mx-0 md:w-0 md:min-w-full md:border-t-0 md:py-3 md:bg-white md:rounded-3xl md:shadow-md" />
      </div>
    </>
  )
}
