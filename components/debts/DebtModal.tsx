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
    'w-full bg-white border border-line rounded-[12px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue transition-colors'
  const labelClass = 'block text-xs font-bold text-muted mb-1.5 uppercase tracking-wide'

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[28px] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black font-display text-ink">
            {isEdit ? 'Edit Debt' : 'Add Debt'}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none">
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-orange/10 border border-orange/20 rounded-[12px] px-4 py-3 mb-4 text-sm text-orange font-medium">
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
              onChange={(e) => setLinkedBudgetItemId(e.target.value)}
              className={inputClass}
            >
              <option value="">— None —</option>
              {budgetItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.debt_id && item.debt_id !== debt?.id ? ' (linked to another debt)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted mt-1">
              When this budget expense is marked paid, the debt balance updates automatically.
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

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white text-ink border border-line rounded-[12px] px-5 py-2.5 text-sm font-bold hover:border-blue transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-blue text-white rounded-[12px] px-5 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Debt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
