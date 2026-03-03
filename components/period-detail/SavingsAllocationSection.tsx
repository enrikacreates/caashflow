'use client'

import { useState, useRef, useTransition } from 'react'
import { upsertSavingsAllocation, applySavingsAllocations, removeSavingsAllocation } from '@/app/actions/period-savings'
import { smallConfetti, bigConfetti } from '@/lib/confetti'
import { formatCurrency } from '@/lib/utils'
import { calculateAllocationTotals } from '@/lib/calculations'
import type { SavingsGoal, PeriodSavingsAllocation } from '@/lib/types'

type AllocMode = '%' | '$'

interface Props {
  periodId: string
  savingsPool: number
  leftoverBudget: number
  savingsGoals: SavingsGoal[]
  savingsAllocations: PeriodSavingsAllocation[]
  lastPeriodAllocations: PeriodSavingsAllocation[]
}

export default function SavingsAllocationSection({
  periodId,
  savingsPool,
  leftoverBudget,
  savingsGoals,
  savingsAllocations,
  lastPeriodAllocations,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

  // Local state for allocation amounts (optimistic, updates on type)
  const [localAmounts, setLocalAmounts] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    savingsAllocations.forEach((a) => { map[a.savings_goal_id] = a.amount })
    return map
  })

  // Per-goal mode toggle
  const [allocModes, setAllocModes] = useState<Record<string, AllocMode>>({})

  // Show more goals toggle
  const [showAll, setShowAll] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Build lookup for last period
  const lastAllocMap = new Map(lastPeriodAllocations.map((a) => [a.savings_goal_id, a.amount]))

  // Build lookup for existing allocation records (to get id + contributed)
  const allocRecordMap = new Map(savingsAllocations.map((a) => [a.savings_goal_id, a]))

  // Determine which goals to show: ones with allocations first, then by sort_order
  const goalsWithAllocs = savingsGoals.filter((g) => localAmounts[g.id] !== undefined && localAmounts[g.id] > 0)
  const goalsWithoutAllocs = savingsGoals.filter((g) => !goalsWithAllocs.includes(g))
  const orderedGoals = [...goalsWithAllocs, ...goalsWithoutAllocs]

  // Search filter for the "show more" section
  const filteredGoals = searchTerm
    ? orderedGoals.filter((g) => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : orderedGoals

  const displayGoals = showAll ? filteredGoals : filteredGoals.slice(0, 3)
  const hasMore = filteredGoals.length > 3

  // Allocation totals (from local state)
  const localAllocations: PeriodSavingsAllocation[] = Object.entries(localAmounts).map(([goalId, amount]) => {
    const existing = allocRecordMap.get(goalId)
    return {
      id: existing?.id ?? '',
      period_id: periodId,
      household_id: '',
      savings_goal_id: goalId,
      amount,
      contributed: existing?.contributed ?? 0,
      created_at: '',
      updated_at: '',
    }
  })
  const { totalAllocated, hasPendingDeltas } = calculateAllocationTotals(localAllocations)
  const unallocated = savingsPool - totalAllocated
  const isOverAllocated = totalAllocated > savingsPool

  // Pool bar color
  const poolRatio = savingsPool > 0 ? totalAllocated / savingsPool : 0
  const poolBarColor = isOverAllocated
    ? 'bg-orange'
    : poolRatio > 0.9
      ? 'bg-yellow'
      : 'bg-green'

  // ─── Handlers ────────────────────────────────────────────────

  const handleAmountChange = (goalId: string, rawValue: string) => {
    const mode = allocModes[goalId] || '$'
    let dollarAmount: number

    if (rawValue === '') {
      dollarAmount = 0
    } else if (mode === '%') {
      const pct = parseFloat(rawValue)
      dollarAmount = isNaN(pct) ? 0 : savingsPool * (pct / 100)
    } else {
      dollarAmount = parseFloat(rawValue) || 0
    }

    // Round to 2 decimal places
    dollarAmount = Math.round(dollarAmount * 100) / 100

    setLocalAmounts((prev) => ({ ...prev, [goalId]: dollarAmount }))

    // Debounced save
    const key = `alloc-${goalId}`
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(() => {
      startTransition(() => upsertSavingsAllocation(periodId, goalId, dollarAmount))
    }, 500)
  }

  const handleRemoveAllocation = (goalId: string) => {
    const record = allocRecordMap.get(goalId)
    if (record) {
      startTransition(() => removeSavingsAllocation(record.id, periodId))
    }
    setLocalAmounts((prev) => {
      const next = { ...prev }
      delete next[goalId]
      return next
    })
  }

  const handleContribute = () => {
    startTransition(async () => {
      const result = await applySavingsAllocations(periodId)
      if (result.applied.some((a) => a.isNowAchieved)) {
        await bigConfetti()
      } else if (result.applied.some((a) => a.delta > 0)) {
        await smallConfetti()
      }
    })
  }

  const toggleMode = (goalId: string) => {
    setAllocModes((prev) => ({
      ...prev,
      [goalId]: (prev[goalId] || '$') === '$' ? '%' : '$',
    }))
  }

  // Get the display input value based on mode
  const getInputValue = (goalId: string): string => {
    const dollarAmount = localAmounts[goalId] ?? 0
    const mode = allocModes[goalId] || '$'
    if (dollarAmount === 0) return ''
    if (mode === '%') {
      return savingsPool > 0 ? ((dollarAmount / savingsPool) * 100).toFixed(1) : '0'
    }
    return dollarAmount.toString()
  }

  const getHelperText = (goalId: string): string => {
    const dollarAmount = localAmounts[goalId] ?? 0
    if (dollarAmount === 0) return ''
    const mode = allocModes[goalId] || '$'
    if (mode === '%') {
      return `= ${formatCurrency(dollarAmount)}`
    }
    return savingsPool > 0 ? `= ${((dollarAmount / savingsPool) * 100).toFixed(1)}%` : ''
  }

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="bg-white border border-line rounded-[20px] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black font-display text-ink">Savings Allocation</h2>
        <button
          onClick={handleContribute}
          disabled={isPending || !hasPendingDeltas}
          className="text-xs bg-green text-white rounded-[8px] px-4 py-1.5 font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Contribute
        </button>
      </div>

      {/* Depleting Pool Bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-bold text-muted">
            Allocated {formatCurrency(totalAllocated)} of {formatCurrency(savingsPool)}
          </span>
          {isOverAllocated ? (
            <span className="font-bold text-orange">
              Over by {formatCurrency(totalAllocated - savingsPool)}
            </span>
          ) : (
            <span className="text-muted">
              {formatCurrency(unallocated)} remaining
            </span>
          )}
        </div>
        <div className="h-2 bg-cream-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${poolBarColor}`}
            style={{ width: `${Math.min(poolRatio * 100, 100)}%` }}
          />
        </div>
        {isOverAllocated && (
          <p className="text-[10px] text-orange mt-1">
            Over-allocation uses leftover budget ({formatCurrency(leftoverBudget)} available)
          </p>
        )}
      </div>

      {/* Goal Rows */}
      <div className="space-y-3">
        {displayGoals.map((goal) => {
          const dollarAmount = localAmounts[goal.id] ?? 0
          const record = allocRecordMap.get(goal.id)
          const delta = record ? dollarAmount - record.contributed : dollarAmount
          const lastAmount = lastAllocMap.get(goal.id)
          const mode = allocModes[goal.id] || '$'
          const progressPct = goal.target_amount > 0
            ? Math.min((goal.current_amount / goal.target_amount) * 100, 100)
            : 0
          const isPurchase = goal.goal_type === 'purchase'

          return (
            <div
              key={goal.id}
              className={`border rounded-[12px] p-3 ${isPurchase ? 'border-blue/20' : 'border-green/20'}`}
            >
              <div className="flex items-center gap-3">
                {/* Goal info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{isPurchase ? '🎯' : '🌱'}</span>
                    <span className="text-sm font-bold text-ink truncate">{goal.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      isPurchase ? 'bg-blue/10 text-blue' : 'bg-green/10 text-green'
                    }`}>
                      {isPurchase ? 'Purchase' : 'Fund'}
                    </span>
                  </div>
                  {/* Mini progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-cream-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isPurchase ? 'bg-blue' : 'bg-green'}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted whitespace-nowrap">
                      {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                    </span>
                  </div>
                </div>

                {/* Allocation input */}
                <div className="flex items-center gap-1.5">
                  {/* % | $ toggle */}
                  <div className="flex rounded-[6px] border border-line overflow-hidden">
                    <button
                      onClick={() => toggleMode(goal.id)}
                      className={`px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                        mode === '%' ? 'bg-ink text-white' : 'text-muted hover:text-ink'
                      }`}
                    >
                      %
                    </button>
                    <button
                      onClick={() => toggleMode(goal.id)}
                      className={`px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                        mode === '$' ? 'bg-ink text-white' : 'text-muted hover:text-ink'
                      }`}
                    >
                      $
                    </button>
                  </div>

                  <input
                    type="number"
                    step={mode === '%' ? '0.1' : '0.01'}
                    value={getInputValue(goal.id)}
                    placeholder={lastAmount ? (mode === '$' ? lastAmount.toString() : ((lastAmount / (savingsPool || 1)) * 100).toFixed(1)) : '0'}
                    onChange={(e) => handleAmountChange(goal.id, e.target.value)}
                    className="w-20 text-right text-sm font-bold rounded-[8px] border border-line px-2 py-1 focus:outline-none focus:border-blue"
                  />

                  {/* Remove button (only if has allocation) */}
                  {dollarAmount > 0 && (
                    <button
                      onClick={() => handleRemoveAllocation(goal.id)}
                      disabled={isPending}
                      className="text-[10px] text-orange font-bold hover:underline ml-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Helper text row */}
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted">{getHelperText(goal.id)}</span>
                {delta !== 0 && (
                  <span className={`text-[10px] font-bold ${delta > 0 ? 'text-green' : 'text-orange'}`}>
                    {delta > 0 ? '+' : ''}{formatCurrency(delta)} pending
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Show more / search */}
      {hasMore && (
        <div className="mt-3">
          {showAll ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search goals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm rounded-[8px] border border-line px-3 py-1.5 focus:outline-none focus:border-blue"
              />
              <button
                onClick={() => { setShowAll(false); setSearchTerm('') }}
                className="text-xs text-blue font-bold hover:underline"
              >
                Show less
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-blue font-bold hover:underline"
            >
              + {filteredGoals.length - 3} more goals
            </button>
          )}
        </div>
      )}

      {/* Leftover callout */}
      {leftoverBudget > 0 && !isOverAllocated && totalAllocated >= savingsPool && savingsPool > 0 && (
        <div className="mt-4 p-3 bg-cream-2 rounded-[10px]">
          <p className="text-xs text-muted">
            <span className="font-bold text-ink">{formatCurrency(leftoverBudget)}</span> unbudgeted — put it to work?
          </p>
        </div>
      )}
    </div>
  )
}
