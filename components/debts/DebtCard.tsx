'use client'

import { useState, useTransition } from 'react'
import { logPayment, markPaidOff, deleteDebt } from '@/app/actions/debts'
import { bigConfetti, smallConfetti } from '@/lib/confetti'
import { formatCurrency } from '@/lib/utils'
import { Hammer, Trophy, PartyPopper } from 'lucide-react'
import type { Debt } from '@/lib/types'

function calculatePayoffDate(
  currentBalance: number,
  minimumPayment: number,
  interestRate: number | null
): Date | null {
  if (minimumPayment <= 0 || currentBalance <= 0) return null
  let months: number
  if (interestRate && interestRate > 0) {
    const r = interestRate / 100 / 12
    const ratio = (r * currentBalance) / minimumPayment
    if (ratio >= 1) return null // payment doesn't cover interest
    months = -Math.log(1 - ratio) / Math.log(1 + r)
  } else {
    months = currentBalance / minimumPayment
  }
  if (!isFinite(months) || months > 1200) return null
  const date = new Date()
  date.setMonth(date.getMonth() + Math.ceil(months))
  return date
}

function formatPayoffLabel(date: Date): string {
  const months = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44))
  if (months <= 0) return 'This month!'
  if (months === 1) return 'Next month'
  if (months < 12) return `${months} months`
  const y = Math.floor(months / 12)
  const m = months % 12
  return m === 0 ? `${y} yr${y > 1 ? 's' : ''}` : `${y}y ${m}m`
}

interface Props {
  debt: Debt
  onEdit: (debt: Debt) => void
}

export default function DebtCard({ debt, onEdit }: Props) {
  const [isPending, startTransition] = useTransition()
  const [paymentInput, setPaymentInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const progress = debt.original_balance > 0
    ? Math.min(100, ((debt.original_balance - debt.current_balance) / debt.original_balance) * 100)
    : 100

  const payoffDate =
    debt.minimum_payment && !debt.is_paid_off
      ? calculatePayoffDate(debt.current_balance, debt.minimum_payment, debt.interest_rate)
      : null

  const handleLogPayment = () => {
    const amount = parseFloat(paymentInput)
    if (isNaN(amount) || amount <= 0) return setError('Enter a valid payment amount.')
    setError(null)
    startTransition(async () => {
      try {
        const { exceedsMinimum } = await logPayment(debt.id, amount)
        setPaymentInput('')
        if (exceedsMinimum) await smallConfetti()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to log payment.')
      }
    })
  }

  const handleMarkPaidOff = () => {
    startTransition(async () => {
      try {
        await markPaidOff(debt.id)
        await bigConfetti()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to mark as paid off.')
      }
    })
  }

  const handleDelete = () => {
    if (!confirm(`Delete "${debt.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      try {
        await deleteDebt(debt.id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete.')
      }
    })
  }

  if (debt.is_paid_off) {
    return (
      <div className="bg-bg-white rounded-lg shadow-card p-6 opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy size={22} className="text-warning flex-shrink-0" />
            <div>
              <p className="font-semibold text-text-heading line-through">{debt.name}</p>
              <p className="text-caption text-text-muted">
                Paid off {debt.paid_off_at
                  ? new Date(debt.paid_off_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-caption text-text-muted hover:text-warning font-semibold transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-bg-white rounded-lg shadow-card p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-h3 font-semibold text-text-heading">{debt.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            {debt.interest_rate !== null && (
              <span className="text-caption bg-warning/10 text-warning font-semibold px-2 py-0.5 rounded-full">
                {debt.interest_rate}% APR
              </span>
            )}
            {debt.due_day && (
              <span className="text-caption text-text-muted">Due day {debt.due_day}</span>
            )}
          </div>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={() => onEdit(debt)}
            className="text-caption text-primary font-semibold hover:underline"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-caption text-text-muted hover:text-warning font-semibold transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Balance */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-h2 font-bold text-text-heading">{formatCurrency(debt.current_balance)}</p>
          <p className="text-caption text-text-muted mt-0.5">
            of {formatCurrency(debt.original_balance)} original
          </p>
        </div>
        <p className="text-caption font-semibold text-success">{Math.round(progress)}% paid</p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-surface-gray rounded-full h-3 mb-4 overflow-hidden">
        <div
          className="h-3 rounded-full bg-primary-teal transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Details row */}
      <div className="flex items-center gap-4 mb-4 text-caption text-text-muted">
        {debt.minimum_payment && (
          <span>Min. payment: <strong className="text-text-heading">{formatCurrency(debt.minimum_payment)}/mo</strong></span>
        )}
        {payoffDate && (
          <span>Payoff: <strong className="text-text-heading">{formatPayoffLabel(payoffDate)}</strong></span>
        )}
      </div>

      {debt.notes && (
        <p className="text-caption text-text-muted mb-4 italic">{debt.notes}</p>
      )}

      {error && (
        <div className="bg-warning/10 border border-warning/20 rounded-sm px-3 py-2 mb-3 text-caption text-warning font-medium">
          {error}
        </div>
      )}

      {/* Log payment */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-caption">$</span>
          <input
            type="number"
            value={paymentInput}
            onChange={(e) => setPaymentInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogPayment() }}
            placeholder="Log payment…"
            min="0"
            step="0.01"
            className="w-full bg-bg-white border border-border rounded-sm pl-7 pr-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <button
          onClick={handleLogPayment}
          disabled={isPending || !paymentInput}
          className="bg-primary-teal text-text-inverse rounded-full px-4 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
        >
          {isPending ? '…' : 'Log'}
        </button>
      </div>

      {/* Mark as Paid Off */}
      <button
        onClick={handleMarkPaidOff}
        disabled={isPending}
        className="w-full bg-pill-pink text-text-heading rounded-full px-5 py-3 text-label font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        <PartyPopper size={18} />
        Mark as Paid Off
      </button>
    </div>
  )
}
