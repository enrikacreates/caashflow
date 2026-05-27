'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { updatePeriodExpenseDetails, transferFunds, undoTransfer } from '@/app/actions/period-expenses'
import { formatCurrency } from '@/lib/utils'
import type { PeriodExpense, PeriodExpenseTransfer, Account, PriorityCategoryRecord } from '@/lib/types'

const round2 = (n: number) => Math.round(n * 100) / 100

export default function PeriodExpenseEditModal({
  expense, expenses, transfers, accounts, categories, onClose,
}: {
  expense: PeriodExpense
  expenses: PeriodExpense[]
  transfers: PeriodExpenseTransfer[]
  accounts: Account[]
  categories: PriorityCategoryRecord[]
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [alsoMaster, setAlsoMaster] = useState(false)
  const [trackSpending, setTrackSpending] = useState(expense.track_spending)
  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  // ─── Move funds — reallocate funded dollars between this line and another (zero-sum) ──
  // Local optimistic funded-amount overrides, keyed by line id (snapshot + session moves).
  const [funds, setFunds] = useState<Record<string, number>>({})
  const snapFunded = (id: string) => {
    const e = expenses.find((x) => x.id === id)
    return e ? (e.amount_override ?? e.default_amount ?? 0) : 0
  }
  const fundedOf = (e: PeriodExpense) => funds[e.id] ?? (e.amount_override ?? e.default_amount ?? 0)
  const availOf = (e: PeriodExpense) => round2(fundedOf(e) - (Number(e.paid_amount) || 0))
  const applyDelta = (id: string, delta: number) =>
    setFunds((f) => ({ ...f, [id]: round2((f[id] ?? snapFunded(id)) + delta) }))

  const [moveDir, setMoveDir] = useState<'to' | 'from'>('to')
  const [moveOther, setMoveOther] = useState('')
  const [moveAmount, setMoveAmount] = useState('')
  const [moveError, setMoveError] = useState<string | null>(null)
  const [moving, startMove] = useTransition()
  const [history, setHistory] = useState<PeriodExpenseTransfer[]>(
    transfers.filter((t) => t.from_expense_id === expense.id || t.to_expense_id === expense.id),
  )
  const nameById = new Map(expenses.map((e) => [e.id, e.name]))
  const moveTargets = expenses.filter((e) => e.id !== expense.id)
  const otherExp = expenses.find((e) => e.id === moveOther)
  // The line money comes OUT of bounds the move: "to" drains this line, "from" drains the other.
  const capSource = moveDir === 'to' ? expense : otherExp ?? null
  const moveCap = capSource ? availOf(capSource) : 0

  const handleMove = () => {
    const amt = round2(parseFloat(moveAmount))
    setMoveError(null)
    if (!moveOther) { setMoveError(moveDir === 'to' ? 'Pick a destination line' : 'Pick a source line'); return }
    if (!(amt > 0)) { setMoveError('Enter an amount greater than 0'); return }
    if (amt > moveCap + 0.005) { setMoveError(`Only ${formatCurrency(moveCap)} available to move`); return }
    const fromId = moveDir === 'to' ? expense.id : moveOther
    const toId = moveDir === 'to' ? moveOther : expense.id
    startMove(async () => {
      try {
        const row = await transferFunds(fromId, toId, amt)
        if (row) setHistory((h) => [row, ...h])
        applyDelta(fromId, -amt)
        applyDelta(toId, amt)
        setMoveAmount('')
        setMoveOther('')
      } catch (err) {
        setMoveError(err instanceof Error ? err.message : 'Move failed')
      }
    })
  }

  const handleUndo = (t: PeriodExpenseTransfer) => {
    startMove(async () => {
      try {
        await undoTransfer(t.id)
        setHistory((h) => h.filter((x) => x.id !== t.id))
        applyDelta(t.from_expense_id, Number(t.amount))
        applyDelta(t.to_expense_id, -Number(t.amount))
      } catch {
        setMoveError('Undo failed')
      }
    })
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const due = (fd.get('due_day') as string)?.trim()
    startTransition(async () => {
      await updatePeriodExpenseDetails(expense.id, {
        name: (fd.get('name') as string).trim(),
        default_amount: parseFloat(fd.get('default_amount') as string) || 0,
        account: ((fd.get('account') as string) || '').trim() || null,
        priority_category: ((fd.get('priority_category') as string) || '').trim() || null,
        due_day: due ? parseInt(due, 10) : null,
        pay_url: ((fd.get('pay_url') as string) || '').trim() || null,
        notes: ((fd.get('notes') as string) || '').trim() || null,
        track_spending: trackSpending,
      }, alsoMaster ? expense.base_item_id : null)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-h3 font-bold text-text-heading">Edit Expense</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl transition-colors">✕</button>
        </div>
        <p className="text-caption text-text-muted mb-5">Changes apply to this budget only — your baseline template stays untouched.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Name *</label>
            <input type="text" name="name" required defaultValue={expense.name} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Amount</label>
              <input type="number" name="default_amount" step="0.01" defaultValue={expense.default_amount || ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Due Day (1-31)</label>
              <input type="number" name="due_day" min="1" max="31" defaultValue={expense.due_day || ''} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Link (where to pay)</label>
            <input type="url" name="pay_url" placeholder="https://..." defaultValue={expense.pay_url || ''} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Account</label>
              <select name="account" defaultValue={expense.account || ''} className={inputClass}>
                <option value="">—</option>
                {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Priority</label>
              <select name="priority_category" defaultValue={expense.priority_category || ''} className={inputClass}>
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-caption font-semibold text-text-heading mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={expense.notes || ''} className={inputClass + ' resize-y'} />
          </div>

          {/* Move funds — reallocate funded dollars to/from another line (zero-sum, both directions) */}
          <div className="bg-surface-beige rounded-sm p-3 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-caption font-semibold text-text-heading">Move funds</span>
              <span className="text-caption text-text-muted">{formatCurrency(availOf(expense))} available here</span>
            </div>
            <div className="flex gap-2">
              <div className="inline-flex rounded-full border border-border overflow-hidden text-[11px] font-bold shrink-0">
                <button type="button" onClick={() => { setMoveDir('to'); setMoveError(null) }} className={`px-3 py-2.5 transition-colors ${moveDir === 'to' ? 'bg-text-heading text-white' : 'bg-bg-white text-text-muted hover:text-text-heading'}`}>To</button>
                <button type="button" onClick={() => { setMoveDir('from'); setMoveError(null) }} className={`px-3 py-2.5 transition-colors ${moveDir === 'from' ? 'bg-text-heading text-white' : 'bg-bg-white text-text-muted hover:text-text-heading'}`}>From</button>
              </div>
              <select
                value={moveOther}
                onChange={(e) => { setMoveOther(e.target.value); setMoveError(null) }}
                className={inputClass + ' flex-1'}
              >
                <option value="">{moveDir === 'to' ? 'Move to…' : 'Move from…'}</option>
                {moveTargets.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div className="relative w-28 shrink-0">
                <input
                  type="number"
                  step="0.01"
                  value={moveAmount}
                  onChange={(e) => { setMoveAmount(e.target.value); setMoveError(null) }}
                  placeholder="0.00"
                  className={inputClass + ' pr-12'}
                />
                <button
                  type="button"
                  onClick={() => { setMoveAmount(String(moveCap)); setMoveError(null) }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-primary hover:underline"
                >
                  All
                </button>
              </div>
              <button
                type="button"
                onClick={handleMove}
                disabled={moving || moveCap <= 0}
                className="bg-primary-teal text-text-inverse rounded-full px-4 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
              >
                Move
              </button>
            </div>
            {moveDir === 'from' && otherExp && (
              <p className="text-[11px] text-text-muted">{otherExp.name} has {formatCurrency(availOf(otherExp))} available</p>
            )}
            {moveError && <p className="text-[11px] text-red-500">{moveError}</p>}
            {history.length > 0 && (
              <ul className="space-y-1 pt-0.5">
                {history.map((t) => {
                  const outgoing = t.from_expense_id === expense.id
                  const other = outgoing ? nameById.get(t.to_expense_id) : nameById.get(t.from_expense_id)
                  return (
                    <li key={t.id} className="flex items-center justify-between text-[11px] text-text-muted">
                      <span>
                        {outgoing ? '→ ' : '← '}{formatCurrency(Number(t.amount))} {outgoing ? 'to' : 'from'} {other ?? 'another line'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUndo(t)}
                        disabled={moving}
                        className="font-semibold text-primary hover:underline disabled:opacity-50"
                      >
                        Undo
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Track spending — turns this line into a draw-down category (log spends, attach receipts) */}
          <label className="flex items-start gap-2.5 bg-surface-beige rounded-sm p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={trackSpending}
              onChange={(e) => setTrackSpending(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary-teal shrink-0"
            />
            <span className="text-caption text-text-heading">
              <span className="font-semibold">Track spending</span>
              <span className="text-text-muted"> — draw this down as you spend (log spends + receipts). Leave off for fixed bills you just pay in full.</span>
            </span>
          </label>

          {expense.base_item_id && (
            <label className="flex items-start gap-2.5 bg-surface-beige rounded-sm p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={alsoMaster}
                onChange={(e) => setAlsoMaster(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary-teal shrink-0"
              />
              <span className="text-caption text-text-heading">
                <span className="font-semibold">Also save to master</span>
                <span className="text-text-muted"> — apply these changes to the recurring template so future budgets inherit them.</span>
              </span>
            </label>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            {expense.base_item_id ? (
              <Link
                href={`/base-budget?edit=${expense.base_item_id}`}
                className="text-caption text-text-muted hover:text-primary font-semibold transition-colors"
              >
                Edit recurring item →
              </Link>
            ) : <span />}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-bg-white text-text-heading border border-border rounded-full px-5 py-2.5 text-caption font-semibold hover:border-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
