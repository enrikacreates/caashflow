'use client'

import { useState, useTransition } from 'react'
import {
  createSavingsGoal,
  updateSavingsGoal,
  setSavingsGoalBudgetItemLink,
} from '@/app/actions/savings'
import type { SavingsGoal, BaseBudgetItem } from '@/lib/types'

interface Props {
  goal?: SavingsGoal
  budgetItems: BaseBudgetItem[]
  onClose: () => void
}

export default function SavingsGoalModal({ goal, budgetItems, onClose }: Props) {
  const isEdit = !!goal
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(goal?.name ?? '')
  const [goalType, setGoalType] = useState<'purchase' | 'fund'>(goal?.goal_type ?? 'purchase')
  const [targetAmount, setTargetAmount] = useState(goal?.target_amount?.toString() ?? '')
  const [currentAmount, setCurrentAmount] = useState(goal?.current_amount?.toString() ?? '0')
  const [monthlyContribution, setMonthlyContribution] = useState(
    goal?.monthly_contribution?.toString() ?? ''
  )
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')
  const [notes, setNotes] = useState(goal?.notes ?? '')

  const currentLinkedItem = goal
    ? budgetItems.find((b) => b.savings_goal_id === goal.id)
    : undefined
  const [linkedBudgetItemId, setLinkedBudgetItemId] = useState<string>(
    currentLinkedItem?.id ?? ''
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedTarget = parseFloat(targetAmount)
    const parsedCurrent = parseFloat(currentAmount)

    if (!name.trim()) return setError('Name is required.')
    if (isNaN(parsedTarget) || parsedTarget <= 0)
      return setError('Target amount must be a positive number.')
    if (isNaN(parsedCurrent) || parsedCurrent < 0)
      return setError('Current amount must be 0 or more.')

    const payload = {
      name: name.trim(),
      goal_type: goalType,
      target_amount: parsedTarget,
      current_amount: parsedCurrent,
      monthly_contribution: monthlyContribution ? parseFloat(monthlyContribution) : null,
      target_date: targetDate || null,
      notes: notes.trim() || null,
    }

    startTransition(async () => {
      try {
        let goalId: string
        if (isEdit) {
          await updateSavingsGoal(goal.id, payload)
          goalId = goal.id
        } else {
          const created = await createSavingsGoal(payload)
          goalId = created.id
        }
        await setSavingsGoalBudgetItemLink(goalId, linkedBudgetItemId || null)
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
            {isEdit ? 'Edit Goal' : 'Add Savings Goal'}
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
          {/* Goal type */}
          <div>
            <label className={labelClass}>Goal Type *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGoalType('purchase')}
                className={`flex items-center gap-2 px-4 py-3 rounded-[12px] border text-sm font-bold transition-colors ${
                  goalType === 'purchase'
                    ? 'border-blue bg-blue/5 text-blue'
                    : 'border-line text-muted hover:border-blue/40'
                }`}
              >
                <span>🎯</span>
                <div className="text-left">
                  <p className="font-bold">Purchase</p>
                  <p className="text-[10px] font-normal text-muted">Trip, item, event</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setGoalType('fund')}
                className={`flex items-center gap-2 px-4 py-3 rounded-[12px] border text-sm font-bold transition-colors ${
                  goalType === 'fund'
                    ? 'border-green bg-green/5 text-green'
                    : 'border-line text-muted hover:border-green/40'
                }`}
              >
                <span>🌱</span>
                <div className="text-left">
                  <p className="font-bold">Fund</p>
                  <p className="text-[10px] font-normal text-muted">Emergency, ongoing</p>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={goalType === 'purchase' ? 'Family vacation, New laptop…' : 'Emergency fund, Rainy day…'}
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Target Amount *</label>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Already Saved</label>
              <input
                type="number"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Monthly Goal</label>
              <input
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Target Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className={inputClass}
              />
            </div>
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
                  {item.savings_goal_id && item.savings_goal_id !== goal?.id
                    ? ' (linked to another goal)'
                    : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted mt-1">
              When this budget expense is marked paid, the savings goal updates automatically.
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
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
