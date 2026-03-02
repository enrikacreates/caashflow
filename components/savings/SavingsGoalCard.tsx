'use client'

import { useState, useTransition } from 'react'
import { addContribution, markAchieved, deleteSavingsGoal } from '@/app/actions/savings'
import { bigConfetti, smallConfetti } from '@/lib/confetti'
import type { SavingsGoal } from '@/lib/types'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

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
}

export default function SavingsGoalCard({ goal, onEdit }: Props) {
  const [isPending, startTransition] = useTransition()
  const [contributionInput, setContributionInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isPurchase = goal.goal_type === 'purchase'

  const progressPercent =
    goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0
  const isOverflowing = progressPercent > 100
  const clampedProgress = Math.min(100, progressPercent)

  const days = goal.target_date ? daysUntil(goal.target_date) : null

  const handleContribute = () => {
    const amount = parseFloat(contributionInput)
    if (isNaN(amount) || amount <= 0) return setError('Enter a valid amount.')
    setError(null)
    startTransition(async () => {
      try {
        const { exceedsMonthly, isNowAchieved } = await addContribution(goal.id, amount)
        setContributionInput('')
        if (isNowAchieved) {
          await bigConfetti()
        } else if (exceedsMonthly) {
          await smallConfetti()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add contribution.')
      }
    })
  }

  const handleMarkAchieved = () => {
    startTransition(async () => {
      try {
        await markAchieved(goal.id)
        await bigConfetti()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to mark as achieved.')
      }
    })
  }

  const handleDelete = () => {
    if (!confirm(`Delete "${goal.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      try {
        await deleteSavingsGoal(goal.id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete.')
      }
    })
  }

  // Achieved state
  if (goal.is_achieved) {
    return (
      <div className="bg-white border border-line rounded-[20px] p-6 opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-bold text-ink line-through">{goal.name}</p>
              <p className="text-xs text-muted">
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
            className="text-xs text-muted hover:text-orange font-bold transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={
        isPurchase
          ? 'bg-white border border-blue/30 rounded-[20px] p-6'
          : 'bg-white border border-green/30 rounded-[20px] p-6'
      }
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{isPurchase ? '🎯' : '🌱'}</span>
          <div>
            <h3 className="text-lg font-black font-display text-ink">{goal.name}</h3>
            <div className="flex items-center flex-wrap gap-2 mt-0.5">
              {isPurchase ? (
                <span className="text-xs bg-blue/10 text-blue font-bold px-2 py-0.5 rounded-full">
                  Purchase
                </span>
              ) : (
                <span className="text-xs bg-green/10 text-green font-bold px-2 py-0.5 rounded-full">
                  Fund
                </span>
              )}
              {goal.target_date && (
                <span
                  className={
                    days !== null && days < 30 ? 'text-xs text-orange' : 'text-xs text-muted'
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
                <span className="text-xs text-muted">
                  {formatCurrency(goal.monthly_contribution)}/mo goal
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={() => onEdit(goal)}
            className="text-xs text-blue font-bold hover:underline"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs text-muted hover:text-orange font-bold transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Amount */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-3xl font-black text-ink">{formatCurrency(goal.current_amount)}</p>
          <p className="text-xs text-muted mt-0.5">of {formatCurrency(goal.target_amount)} goal</p>
        </div>
        {isPurchase ? (
          <p className="text-sm font-bold text-blue">
            {isOverflowing ? '100% ✓' : `${Math.round(progressPercent)}%`}
          </p>
        ) : (
          <p className="text-sm font-bold text-green">
            {isOverflowing
              ? `+${formatCurrency(goal.current_amount - goal.target_amount)} over`
              : `${Math.round(progressPercent)}%`}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-line rounded-full h-3 mb-4 overflow-hidden relative">
        {isPurchase ? (
          <div
            className="h-3 rounded-full bg-blue transition-all duration-500"
            style={{ width: `${clampedProgress}%` }}
          />
        ) : (
          <>
            <div
              className="h-3 rounded-full bg-green transition-all duration-500"
              style={{ width: `${clampedProgress}%` }}
            />
            {isOverflowing && (
              <div className="absolute inset-0 rounded-full bg-green/20 animate-pulse" />
            )}
          </>
        )}
      </div>

      {goal.notes && <p className="text-xs text-muted mb-4 italic">{goal.notes}</p>}

      {error && (
        <div className="bg-orange/10 border border-orange/20 rounded-[12px] px-3 py-2 mb-3 text-xs text-orange font-medium">
          {error}
        </div>
      )}

      {/* Add contribution */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
          <input
            type="number"
            value={contributionInput}
            onChange={(e) => setContributionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleContribute()
            }}
            placeholder="Add contribution…"
            min="0"
            step="0.01"
            className="w-full bg-white border border-line rounded-[12px] pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue transition-colors"
          />
        </div>
        {isPurchase ? (
          <button
            onClick={handleContribute}
            disabled={isPending || !contributionInput}
            className="bg-blue text-white rounded-[12px] px-4 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            {isPending ? '…' : 'Add'}
          </button>
        ) : (
          <button
            onClick={handleContribute}
            disabled={isPending || !contributionInput}
            className="bg-green text-white rounded-[12px] px-4 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            {isPending ? '…' : 'Add'}
          </button>
        )}
      </div>

      {/* Mark as Achieved */}
      {isPurchase ? (
        <button
          onClick={handleMarkAchieved}
          disabled={isPending}
          className="w-full bg-blue text-white rounded-[14px] px-5 py-3 text-base font-black font-display hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          🎉 Mark as Achieved
        </button>
      ) : (
        <button
          onClick={handleMarkAchieved}
          disabled={isPending}
          className="w-full bg-green text-white rounded-[14px] px-5 py-3 text-base font-black font-display hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          🎉 Mark as Achieved
        </button>
      )}
    </div>
  )
}
