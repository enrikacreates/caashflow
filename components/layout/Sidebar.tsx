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
} from 'lucide-react'

/* -------------------------------------------------------
 * NAV ITEMS — flat list, no sections
 * ------------------------------------------------------- */
const NAV_ITEMS = [
  { name: 'Budgets',    href: '/periods',     icon: Calendar  },
  { name: 'Cash',       href: '/cashflow',    icon: BarChart2 },
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
}: {
  open: boolean
  onClose: () => void
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

      {/* ── Floating nav card ───────────────────────────── */}
      <nav
        className={`
          fixed z-50
          bg-white rounded-3xl shadow-md
          px-2 py-3
          transition-all duration-200

          /* Mobile: full slide-in panel */
          top-0 left-0 h-screen w-[220px]
          md:top-auto md:left-6 md:h-auto md:w-auto
          md:rounded-3xl

          /* Desktop: floating card below header */
          md:mt-[120px]

          md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
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
      </nav>
    </>
  )
}
