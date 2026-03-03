'use client'

import { useState, useTransition, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { deleteBaseBudgetItem, resetBaseBudgetToDefaults } from '@/app/actions/base-budget'
import { formatCurrency, getPriorityColor } from '@/lib/utils'
import type { BaseBudgetItem, Frequency, Account, PriorityCategoryRecord } from '@/lib/types'
import ExpenseFormModal from './ExpenseFormModal'

const FREQUENCY_ORDER: Frequency[] = ['Monthly', 'Weekly', 'Annually', 'One-Time']

type SortKey = 'name' | 'default_amount' | 'due_day' | 'account' | 'priority_category'

interface Props {
  items: BaseBudgetItem[]
  accounts: Account[]
  categories: PriorityCategoryRecord[]
}

export default function BaseBudgetClient({ items, accounts, categories }: Props) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<BaseBudgetItem | null>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const searchParams = useSearchParams()
  const router = useRouter()

  // Deep-link: ?edit=<itemId> auto-opens the edit modal
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) {
      const item = items.find((i) => i.id === editId)
      if (item) {
        setEditItem(item)
        setModalOpen(true)
      }
      // Clear the query param so refreshing doesn't re-open
      router.replace('/base-budget', { scroll: false })
    }
  }, [searchParams, items, router])

  // Build a lookup map: category name → color_key
  const categoryColorMap = new Map(categories.map(c => [c.name, c.color_key]))

  const grouped = FREQUENCY_ORDER.map((freq) => ({
    frequency: freq,
    items: items.filter((i) => i.frequency === freq),
    total: items.filter((i) => i.frequency === freq).reduce((s, i) => s + i.default_amount, 0),
  })).filter((g) => g.items.length > 0)

  const sortItems = (list: BaseBudgetItem[]) => {
    if (!sortKey) return list
    return [...list].sort((a, b) => {
      let vA: string | number, vB: string | number
      switch (sortKey) {
        case 'name': vA = a.name.toLowerCase(); vB = b.name.toLowerCase(); break
        case 'default_amount': vA = a.default_amount; vB = b.default_amount; break
        case 'due_day': vA = a.due_day || 99; vB = b.due_day || 99; break
        case 'account': vA = a.account || ''; vB = b.account || ''; break
        case 'priority_category': vA = a.priority_category || 'Z'; vB = b.priority_category || 'Z'; break
        default: return 0
      }
      const cmp = vA < vB ? -1 : vA > vB ? 1 : 0
      return sortDir === 'desc' ? -cmp : cmp
    })
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    startTransition(() => deleteBaseBudgetItem(id))
  }

  const handleReset = () => {
    if (!confirm('Reset all base budget items to defaults? This will delete your current items.')) return
    startTransition(() => resetBaseBudgetToDefaults())
  }

  const thClass = (key: SortKey) =>
    `text-left text-xs font-bold uppercase text-ink px-4 py-3 cursor-pointer select-none hover:text-blue transition-colors ${
      sortKey === key ? 'text-blue' : ''
    }`

  return (
    <>
      <div className="flex gap-3 mb-6">
        <button onClick={() => { setEditItem(null); setModalOpen(true) }}
          className="bg-blue text-white rounded-[12px] px-5 py-2.5 font-bold hover:opacity-90 text-sm">
          + Add Expense
        </button>
        <button onClick={handleReset} disabled={isPending}
          className="bg-white text-ink border border-line rounded-[12px] px-5 py-2.5 font-bold hover:border-blue text-sm disabled:opacity-50 transition-colors">
          Reset to Defaults
        </button>
      </div>

      {grouped.map((group) => (
        <div key={group.frequency} className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-black font-display text-ink">{group.frequency}</h2>
            <span className="text-sm font-bold text-muted">{formatCurrency(group.total)}</span>
          </div>
          <div className="bg-white border border-line rounded-[20px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-cream-2">
                  <tr>
                    <th className={thClass('name')} onClick={() => toggleSort('name')}>Name {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('default_amount')} onClick={() => toggleSort('default_amount')}>Amount {sortKey === 'default_amount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('due_day')} onClick={() => toggleSort('due_day')}>Due Day {sortKey === 'due_day' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('account')} onClick={() => toggleSort('account')}>Account {sortKey === 'account' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className={thClass('priority_category')} onClick={() => toggleSort('priority_category')}>Priority {sortKey === 'priority_category' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th className="text-left text-xs font-bold uppercase text-ink px-4 py-3">AutoPay</th>
                    <th className="text-left text-xs font-bold uppercase text-ink px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortItems(group.items).map((item) => (
                    <tr key={item.id} className="border-t border-line hover:bg-cream transition-colors">
                      <td className="px-4 py-3 font-medium text-sm">{item.name}</td>
                      <td className="px-4 py-3 text-sm font-bold">{formatCurrency(item.default_amount)}</td>
                      <td className="px-4 py-3 text-sm text-muted">{item.due_day || '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted">{item.account || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${getPriorityColor(categoryColorMap.get(item.priority_category || ''))}`}>
                          {item.priority_category || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{item.auto_pay ? '✓' : ''}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditItem(item); setModalOpen(true) }}
                            className="text-xs text-blue font-bold hover:underline">Edit</button>
                          <button onClick={() => handleDelete(item.id, item.name)}
                            className="text-xs text-orange font-bold hover:underline">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {modalOpen && (
        <ExpenseFormModal
          editItem={editItem}
          onClose={() => { setModalOpen(false); setEditItem(null) }}
          accounts={accounts}
          categories={categories}
        />
      )}
    </>
  )
}
