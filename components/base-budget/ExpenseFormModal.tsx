'use client'

import { useState, useTransition } from 'react'
import { archiveBaseItem, createBaseBudgetItem, updateBaseBudgetItem } from '@/app/actions/base-budget'
import { localToday } from '@/lib/sessions'
import { notifyError } from '@/lib/toast'
import type { BaseBudgetItem, Account, PriorityCategoryRecord } from '@/lib/types'
import { FREQUENCIES } from '@/lib/types'
import { DEFAULT_ANNUAL_NOTICE_MONTHS, monthsUntilDue } from '@/lib/annual'
import { formatCurrency } from '@/lib/utils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const NOTICE_CHOICES = [1, 2, 3, 4, 6]

export default function ExpenseFormModal({
  editItem,
  onClose,
  accounts,
  categories,
  tagOptions,
  onArchived,
}: {
  editItem: BaseBudgetItem | null
  onClose: () => void
  accounts: Account[]
  categories: PriorityCategoryRecord[]
  tagOptions: string[]
  // Lets the list drop this row right away
  onArchived?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [tags, setTags] = useState<string[]>(editItem?.tags ?? [])
  const [newTag, setNewTag] = useState('')
  const [frequency, setFrequency] = useState<string>(editItem?.frequency || 'Monthly')
  const [amount, setAmount] = useState(editItem?.default_amount ?? 0)
  const [dueMonth, setDueMonth] = useState<number | null>(editItem?.due_month ?? null)
  const [notice, setNotice] = useState<number | null>(editItem?.remind_months ?? null)
  const [split, setSplit] = useState<number | null>(editItem?.split_months ?? null)
  // Only months still ahead can hold a part: can't split a December bill over 3 months in November
  const [thisMonth] = useState(() => new Date().getMonth())
  const maxSplit = dueMonth ? Math.min(monthsUntilDue(dueMonth, thisMonth) + 1, 6) : 1
  const chosenSplit = split && split <= maxSplit ? split : null
  const isAnnual = frequency === 'Annually'

  const allTags = [...new Set([...tagOptions, ...tags])]
  const toggleTag = (t: string) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))
  const addNewTag = () => {
    const t = newTag.trim()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setNewTag('')
  }

  const handleArchive = () => {
    if (!editItem) return
    if (!confirm(`Archive ${editItem.name}?\n\nIt stays in past budgets and stops showing up going forward. You can restore it from Baseline anytime.`)) return
    onClose()
    startTransition(async () => {
      onArchived?.()
      try { await archiveBaseItem(editItem.id, localToday().slice(0, 7)) }
      catch { notifyError('Could not archive that bill. Please try again.') }
    })
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      if (editItem) await updateBaseBudgetItem(formData)
      else await createBaseBudgetItem(formData)
      onClose()
    })
  }

  const chip = (on: boolean) =>
    `rounded-full px-3 py-2 text-caption font-semibold transition-colors ${on ? 'bg-primary-teal text-text-inverse' : 'bg-bg-white text-text-muted hover:text-text-heading'}`
  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[36px] leading-tight font-bold text-text-heading">
            {editItem ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {editItem && <input type="hidden" name="id" value={editItem.id} />}

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Name *</label>
            <input type="text" name="name" required defaultValue={editItem?.name || ''} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Default Amount</label>
              <input type="number" name="default_amount" step="0.01" defaultValue={editItem?.default_amount || ''} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className={inputClass} />
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Due Day (1-31)</label>
              <input type="number" name="due_day" min="1" max="31" defaultValue={editItem?.due_day || ''} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Account</label>
            <select name="account" defaultValue={editItem?.account || ''} className={inputClass}>
              <option value="">Select Account</option>
              {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Priority</label>
            <select name="priority_category" defaultValue={editItem?.priority_category || ''} className={inputClass}>
              <option value="">Select Priority</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Frequency</label>
            <select name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)} className={inputClass}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Annual bills: when it's due, how early to flag it, and whether to split it */}
          <input type="hidden" name="due_month" value={isAnnual && dueMonth ? dueMonth : ''} />
          <input type="hidden" name="remind_months" value={isAnnual && notice != null ? notice : ''} />
          <input type="hidden" name="split_months" value={isAnnual && chosenSplit ? chosenSplit : ''} />
          {isAnnual && (
            <div className="bg-surface-beige rounded-sm p-4 space-y-4">
              <div>
                <span className="block text-caption font-semibold text-text-heading mb-2">Month it&apos;s due</span>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {MONTHS.map((m, i) => (
                    <button key={m} type="button" aria-pressed={dueMonth === i + 1} onClick={() => setDueMonth(i + 1)} className={chip(dueMonth === i + 1)}>{m}</button>
                  ))}
                </div>
                {!dueMonth && <p className="text-[11px] text-text-muted mt-2">Until a month is set, this lands in every budget.</p>}
              </div>
              <div>
                <span className="block text-caption font-semibold text-text-heading mb-2">Show it on the dashboard</span>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" aria-pressed={notice === null} onClick={() => setNotice(null)} className={chip(notice === null)}>Default ({DEFAULT_ANNUAL_NOTICE_MONTHS} months ahead)</button>
                  {NOTICE_CHOICES.map((n) => (
                    <button key={n} type="button" aria-pressed={notice === n} onClick={() => setNotice(n)} className={chip(notice === n)}>{n} mo</button>
                  ))}
                </div>
              </div>
              {dueMonth && (
                <div>
                  <span className="block text-caption font-semibold text-text-heading mb-2">How to pay it</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" aria-pressed={!chosenSplit} onClick={() => setSplit(null)} className={chip(!chosenSplit)}>In full</button>
                    {Array.from({ length: Math.max(maxSplit - 1, 0) }, (_, i) => i + 2).map((n) => (
                      <button key={n} type="button" aria-pressed={chosenSplit === n} onClick={() => setSplit(n)} className={chip(chosenSplit === n)}>{n} payments</button>
                    ))}
                  </div>
                  <p className="text-[11px] text-text-muted mt-2">
                    {chosenSplit
                      ? `${formatCurrency(amount / chosenSplit)} a month, ending in ${MONTHS[dueMonth - 1]}. Each month's budget gets its part.`
                      : `Goes in the ${MONTHS[dueMonth - 1]} budget.`}
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Tags <span className="font-normal text-text-muted">(tap to select)</span></label>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((t) => {
                  const on = tags.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className={`px-2.5 py-1 rounded-full text-caption font-semibold transition-colors ${on ? 'bg-primary-teal text-text-inverse' : 'bg-surface-beige text-text-muted hover:text-text-heading'}`}
                    >
                      {on ? '✓ ' : ''}{t}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewTag() } }}
                placeholder="+ add a tag"
                className={inputClass}
              />
              <button type="button" onClick={addNewTag} className="shrink-0 bg-bg-white text-text-heading border border-border rounded-full px-4 text-caption font-semibold hover:border-primary transition-colors">Add</button>
            </div>
            <input type="hidden" name="tags" value={tags.join(', ')} />
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" name="auto_pay" id="auto_pay" defaultChecked={editItem?.auto_pay || false}
              className="w-5 h-5 accent-primary-teal" />
            <label htmlFor="auto_pay" className="text-caption font-medium text-text-heading">Auto Pay</label>
          </div>

          <div className="flex items-start gap-3">
            <input type="checkbox" name="track_spending" id="track_spending" defaultChecked={editItem?.track_spending || false}
              className="mt-0.5 w-5 h-5 accent-primary-teal shrink-0" />
            <label htmlFor="track_spending" className="text-caption font-medium text-text-heading">
              Track spending
              <span className="block text-text-muted font-normal">Draw this down as you spend (log spends + receipts) — for variable categories like groceries or gas. Leave off for fixed bills.</span>
            </label>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Payment URL</label>
            <input type="text" name="pay_url" placeholder="https://..." defaultValue={editItem?.pay_url || ''} className={inputClass} />
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={editItem?.notes || ''} className={inputClass + ' resize-y'} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {editItem && (
              <button type="button" onClick={handleArchive} className="mr-auto text-caption font-semibold text-text-muted hover:text-warning transition-colors">
                Archive
              </button>
            )}
            <button type="button" onClick={onClose}
              className="bg-bg-white text-text-heading border border-border rounded-full px-5 py-2.5 text-caption font-semibold hover:border-primary transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {isPending ? 'Saving…' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
