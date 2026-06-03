'use client'

import { useState, useTransition } from 'react'
import { Target, Sprout, Trophy, PartyPopper } from 'lucide-react'
import { addSavingsAdjustment, removeSavingsAdjustment, markAchieved, deleteSavingsGoal } from '@/app/actions/savings'
import { bigConfetti, smallConfetti } from '@/lib/confetti'
import { notifyError } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'
import type { SavingsGoal, SavingsGoalAdjustment } from '@/lib/types'
import type { GoalOptUpdate, AdjustmentOptUpdate } from './SavingsClient'

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface Props {
  goal: SavingsGoal
  onEdit: (goal: SavingsGoal) => void
  adjustments: SavingsGoalAdjustment[]
  onOptGoal: (u: GoalOptUpdate) => void
  onOptAdjustment: (u: AdjustmentOptUpdate) => void
}

export default function SavingsGoalCard({ goal, onEdit, adjustments, onOptGoal, onOptAdjustment }: Props) {
  const [isPending, startTransition] = useTransition()
  const [amountInput, setAmountInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isPurchase = goal.goal_type === 'purchase'

  const progressPercent =
    goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0
  const isOverflowing = progressPercent > 100
  const clampedProgress = Math.min(100, progressPercent)

  const days = goal.target_date ? daysUntil(goal.target_date) : null

  const handleAdjust = () => {
    const amount = parseFloat(amountInput)
    if (isNaN(amount) || amount === 0) return setError('Enter a non-zero amount (use − to withdraw).')
    setError(null)
    const noteCopy = noteInput.trim() || null
    const ghost: SavingsGoalAdjustment = {
      id: `tmp-${Date.now()}`,
      household_id: goal.household_id,
      savings_goal_id: goal.id,
      amount,
      note: noteCopy,
      created_at: new Date().toISOString(),
    }
    // Reset inputs first so the field feels instant.
    setAmountInput('')
    setNoteInput('')
    startTransition(async () => {
      onOptAdjustment({ kind: 'add', row: ghost })
      onOptGoal({ kind: 'amount', id: goal.id, delta: amount })
      try {
        const { exceedsMonthly, isNowAchieved } = await addSavingsAdjustment(goal.id, amount, noteCopy)
        if (isNowAchieved) await bigConfetti()
        else if (exceedsMonthly) await smallConfetti()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to adjust balance.')
        notifyError()
      }
    })
  }

  const handleRemoveAdjustment = (id: string) => {
    const adj = adjustments.find((a) => a.id === id)
    startTransition(async () => {
      onOptAdjustment({ kind: 'remove', id })
      if (adj) onOptGoal({ kind: 'amount', id: goal.id, delta: -adj.amount })
      try { await removeSavingsAdjustment(id) }
      catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove entry.')
        notifyError()
      }
    })
  }

  const formatAdjDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const handleMarkAchieved = () => {
    startTransition(async () => {
      onOptGoal({ kind: 'achieve', id: goal.id })
      try {
        await markAchieved(goal.id)
        await bigConfetti()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to mark as achieved.')
        notifyError()
      }
    })
  }

  const handleDelete = () => {
    if (!confirm(`Delete "${goal.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      onOptGoal({ kind: 'delete', id: goal.id })
      try { await deleteSavingsGoal(goal.id) }
      catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete.')
        notifyError()
      }
    })
  }

  // Achieved state
  if (goal.is_achieved) {
    return (
      <div className="bg-bg-white rounded-lg shadow-card p-6 opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy size={22} className="text-warning flex-shrink-0" />
            <div>
              <p className="font-semibold text-text-heading line-through">{goal.name}</p>
              <p className="text-caption text-text-muted">
                Achieved{' '}
                {goal.achieved_at
                  ? new Date(goal.achieved_at).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })
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
        <div className="flex items-start gap-3">
          {isPurchase
            ? <Target size={22} className="text-primary flex-shrink-0 mt-0.5" />
            : <Sprout size={22} className="text-primary-teal flex-shrink-0 mt-0.5" />
          }
          <div>
            <h3 className="text-h3 font-semibold text-text-heading">{goal.name}</h3>
            <div className="flex items-center flex-wrap gap-2 mt-0.5">
              {isPurchase ? (
                <span className="text-caption bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                  Purchase
                </span>
              ) : (
                <span className="text-caption bg-primary-teal/10 text-primary-teal font-semibold px-2 py-0.5 rounded-full">
                  Fund
                </span>
              )}
              {goal.target_date && (
                <span
                  className={
                    days !== null && days < 30
                      ? 'text-caption text-warning'
                      : 'text-caption text-text-muted'
                  }
                >
                  {days !== null && days < 0
                    ? 'Overdue'
                    : days === 0
                    ? 'Today!'
                    : days === 1
                    ? '1 day left'
                    : days !== null
                    ? `${days} days · ${formatShortDate(goal.target_date)}`
                    : formatShortDate(goal.target_date)}
                </span>
              )}
              {goal.monthly_contribution && (
                <span className="text-caption text-text-muted">
                  {formatCurrency(goal.monthly_contribution)}/mo goal
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={() => onEdit(goal)}
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

      {/* Amount */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-h2 font-bold text-text-heading">{formatCurrency(goal.current_amount)}</p>
          <p className="text-caption text-text-muted mt-0.5">
            of {formatCurrency(goal.target_amount)} goal
          </p>
        </div>
        {isPurchase ? (
          <p className="text-caption font-semibold text-primary">
            {isOverflowing ? '100% ✓' : `${Math.round(progressPercent)}%`}
          </p>
        ) : (
          <p className="text-caption font-semibold text-primary-teal">
            {isOverflowing
              ? `+${formatCurrency(goal.current_amount - goal.target_amount)} over`
              : `${Math.round(progressPercent)}%`}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-surface-gray rounded-full h-3 mb-4 overflow-hidden relative">
        {isPurchase ? (
          <div
            className="h-3 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${clampedProgress}%` }}
          />
        ) : (
          <>
            <div
              className="h-3 rounded-full bg-primary-teal transition-all duration-500"
              style={{ width: `${clampedProgress}%` }}
            />
            {isOverflowing && (
              <div className="absolute inset-0 rounded-full bg-primary-teal/20 animate-pulse" />
            )}
          </>
        )}
      </div>

      {goal.notes && (
        <p className="text-caption text-text-muted mb-4 italic">{goal.notes}</p>
      )}

      {error && (
        <div className="bg-warning/10 border border-warning/20 rounded-sm px-3 py-2 mb-3 text-caption text-warning font-medium">
          {error}
        </div>
      )}

      {/* Adjust balance (+/−) with a note */}
      <div className="flex gap-2 mb-1">
        <div className="relative w-28 shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-caption">$</span>
          <input
            type="number"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdjust() }}
            placeholder="±0.00"
            step="0.01"
            className="w-full bg-bg-white border border-border rounded-sm pl-7 pr-3 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <input
          type="text"
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdjust() }}
          placeholder="Note (e.g. vet bill, $100 from checking)"
          className="flex-1 min-w-0 bg-bg-white border border-border rounded-sm px-3 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors"
        />
        <button
          onClick={handleAdjust}
          disabled={isPending || !amountInput}
          className="bg-primary-teal text-text-inverse rounded-full px-4 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
        >
          {isPending ? '…' : 'Add'}
        </button>
      </div>
      <p className="text-[10px] text-text-muted mb-3 ml-1">Use a negative amount to record a withdrawal.</p>

      {/* History ledger */}
      {adjustments.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase text-text-muted mb-1.5">History</p>
          <div className="divide-y divide-[#e9e9e9] max-h-44 overflow-y-auto">
            {adjustments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-1.5">
                <span className="text-[10px] text-text-muted w-12 shrink-0">{formatAdjDate(a.created_at)}</span>
                <span className={`text-caption font-bold w-20 shrink-0 ${a.amount < 0 ? 'text-warning' : 'text-success'}`}>
                  {a.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(a.amount))}
                </span>
                <span className="flex-1 min-w-0 text-caption text-text-muted truncate">{a.note || '—'}</span>
                <button
                  onClick={() => handleRemoveAdjustment(a.id)}
                  disabled={isPending}
                  title="Undo this entry"
                  className="shrink-0 text-text-muted hover:text-warning text-[10px] font-semibold disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mark as Achieved */}
      <button
        onClick={handleMarkAchieved}
        disabled={isPending}
        className="w-full bg-pill-pink text-text-heading rounded-full px-5 py-3 text-label font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        <PartyPopper size={18} />
        Mark as Achieved
      </button>
    </div>
  )
}
