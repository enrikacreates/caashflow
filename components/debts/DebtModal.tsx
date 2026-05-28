'use client'

import { useState, useTransition } from 'react'
import { createDebt, updateDebt, setDebtBudgetItemLink } from '@/app/actions/debts'
import type { Debt, BaseBudgetItem } from '@/lib/types'

interface Props {
  debt?: Debt
  budgetItems: BaseBudgetItem[]
  onClose: () => void
}

export default function DebtModal({ debt, budgetItems, onClose }: Props) {
  const isEdit = !!debt
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(debt?.name ?? '')
  const [originalBalance, setOriginalBalance] = useState(
    debt?.original_balance?.toString() ?? ''
  )
  const [currentBalance, setCurrentBalance] = useState(
    debt?.current_balance?.toString() ?? ''
  )
  const [interestRate, setInterestRate] = useState(
    debt?.interest_rate?.toString() ?? ''
  )
  const [minimumPayment, setMinimumPayment] = useState(
    debt?.minimum_payment?.toString() ?? ''
  )
  const [dueDay, setDueDay] = useState(debt?.due_day?.toString() ?? '')
  const [notes, setNotes] = useState(debt?.notes ?? '')

  const currentLinkedItem = debt
    ? budgetItems.find((b) => b.debt_id === debt.id)
    : undefined
  const [linkedBudgetItemId, setLinkedBudgetItemId] = useState<string>(
    currentLinkedItem?.id ?? ''
  )

  // Only budget items categorized as debt (plus the currently-linked one, if any)
  const debtItems = budgetItems.filter(
    (b) => b.priority_category?.toLowerCase().includes('debt') || b.id === currentLinkedItem?.id
  )

  // Selecting a debt expense pulls its data into the debt form + connects them
  const handleLinkChange = (id: string) => {
    setLinkedBudgetItemId(id)
    const item = budgetItems.find((b) => b.id === id)
    if (item) {
      if (!name.trim()) setName(item.name)
      setMinimumPayment(item.default_amount ? String(item.default_amount) : '')
      if (item.due_day != null) setDueDay(String(item.due_day))
    }
  }

  // When original balance changes on a new debt, keep current in sync
  const handleOriginalChange = (val: string) => {
    setOriginalBalance(val)
    if (!isEdit && !currentBalance) setCurrentBalance(val)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedOriginal = parseFloat(originalBalance)
    const parsedCurrent = parseFloat(currentBalance)

    if (!name.trim()) return setError('Name is required.')
    if (isNaN(parsedOriginal) || parsedOriginal <= 0) return setError('Original balance must be a positive number.')
    if (isNaN(parsedCurrent) || parsedCurrent < 0) return setError('Current balance must be 0 or more.')

    const payload = {
      name: name.trim(),
      original_balance: parsedOriginal,
      current_balance: parsedCurrent,
      interest_rate: interestRate ? parseFloat(interestRate) : null,
      minimum_payment: minimumPayment ? parseFloat(minimumPayment) : null,
      due_day: dueDay ? parseInt(dueDay) : null,
      notes: notes.trim() || null,
    }

    startTransition(async () => {
      try {
        let debtId: string
        if (isEdit) {
          await updateDebt(debt.id, payload)
          debtId = debt.id
        } else {
          const created = await createDebt(payload)
          debtId = created.id
        }
        await setDebtBudgetItemLink(debtId, linkedBudgetItemId || null)
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
      }
    })
  }

  const inputClass =
    'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'
  const labelClass = 'block text-caption font-semibold text-text-heading mb-1'

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h3 font-bold text-text-heading">
            {isEdit ? 'Edit Debt' : 'Add Debt'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-heading text-xl transition-colors">
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-warning/10 border border-warning/20 rounded-sm px-4 py-3 mb-4 text-caption text-warning font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chase Sapphire, Student Loan…"
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Original Balance *</label>
              <input
                type="number"
                value={originalBalance}
                onChange={(e) => handleOriginalChange(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Current Balance *</label>
              <input
                type="number"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Interest Rate (APR %)</label>
              <input
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="e.g. 19.99"
                min="0"
                step="0.01"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Min. Monthly Payment</label>
              <input
                type="number"
                value={minimumPayment}
                onChange={(e) => setMinimumPayment(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Payment Due Day</label>
            <input
              type="number"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="e.g. 15"
              min="1"
              max="31"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Linked Budget Item</label>
            <select
              value={linkedBudgetItemId}
              onChange={(e) => handleLinkChange(e.target.value)}
              className={inputClass}
            >
              <option value="">— None —</option>
              {debtItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.debt_id && item.debt_id !== debt?.id ? ' (linked to another debt)' : ''}
                </option>
              ))}
            </select>
            <p className="text-caption text-text-muted mt-1">
              Pick the matching debt expense — it fills in the payment &amp; due day, and links so the debt balance updates when that expense is marked paid.
            </p>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any extra details…"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
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
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Debt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
