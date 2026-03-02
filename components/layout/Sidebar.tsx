'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/actions/auth'

const NAV_ITEMS = [
  { label: 'Main', items: [
    { name: 'Dashboard', href: '/', icon: '\u{1F4CA}' },
    { name: 'Budget Periods', href: '/periods', icon: '\u{1F4C5}' },
    { name: 'Base Budget', href: '/base-budget', icon: '\u{1F4CB}' },
  ]},
  { label: 'Planning', items: [
    { name: 'Debt Demo', href: '/debts', icon: '\u{1F528}' },
    { name: 'Savings Goals', href: '/savings', icon: '\u{1F331}' },
    { name: 'Budget Requests', href: '/requests', icon: '\u{1F6D2}' },
    { name: 'Cash Flow', href: '/cashflow', icon: '\u{1F4B0}' },
  ]},
  { label: 'Settings', items: [
    { name: 'Settings', href: '/settings', icon: '\u2699\uFE0F' },
  ]},
]

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          fixed left-0 top-0 h-screen w-[250px] bg-cream-2 border-r border-line
          p-6 overflow-y-auto z-50 transition-transform duration-200
          md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="mb-8 pb-6 border-b border-line">
          <div className="text-2xl font-black font-display text-ink">CAASHFLOW</div>
          <div className="text-xs text-muted uppercase tracking-widest font-semibold mt-1">
            Budget System
          </div>
        </div>

        {NAV_ITEMS.map((section) => (
          <nav key={section.label} className="mb-6">
            <div className="text-xs uppercase text-muted font-bold tracking-wide mb-2">
              {section.label}
            </div>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-[12px] text-sm font-medium
                  transition-all border-l-[3px]
                  ${isActive(item.href)
                    ? 'text-ink font-bold border-blue'
                    : 'text-muted hover:text-ink border-transparent'
                  }
                `}
              >
                <span className="w-5 h-5 flex items-center justify-center text-sm">
                  {item.icon}
                </span>
                {item.name}
              </Link>
            ))}
          </nav>
        ))}

        <div className="mt-auto pt-6 border-t border-line">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left px-3 py-2 text-sm text-muted hover:text-ink transition-colors font-medium"
            >
              Sign Out
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
