'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { setIncomeMonthAnswer } from '@/app/actions/settings'
import { incomeGaps, incomeStability } from '@/lib/stability'
import type { IncomeGap, IncomeMonthAnswer, IncomeMonthAnswers } from '@/lib/stability'

function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })
}

function plural(count: number): string {
  return `${count} ${count === 1 ? 'month' : 'months'}`
}

/** One month's question. Tapping the chosen answer again clears it. */
function GapRow({ gap, onAnswer }: { gap: IncomeGap; onAnswer: (month: string, answer: IncomeMonthAnswer | null) => void }) {
  const choice = (answer: IncomeMonthAnswer, label: string) => {
    const chosen = gap.answer === answer
    return (
      <button
        type="button"
        aria-pressed={chosen}
        onClick={() => onAnswer(gap.month, chosen ? null : answer)}
        className={`rounded-full px-3 py-1 text-caption font-semibold shadow-card transition-colors ${
          chosen ? 'bg-primary-teal text-white' : 'bg-bg-white text-text-heading hover:text-primary'
        }`}
      >
        {label}
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="text-caption text-text-muted">No income for {monthName(gap.month)}.</span>
      <span className="flex items-center gap-2">
        {choice('not_tracked', 'Not tracked')}
        <span className="text-caption text-text-muted">or</span>
        {choice('no_earnings', 'No earnings')}
      </span>
    </div>
  )
}

/** Stability score against a 0-100 scale, the shape of recent income, and questions about months with no income. */
export default function IncomeStabilityBar({
  incomeByMonth,
  currentMonth,
  answers,
}: {
  incomeByMonth: Record<string, number>
  currentMonth: string
  answers: IncomeMonthAnswers
}) {
  const [optimisticAnswers, applyAnswer] = useOptimistic(
    answers,
    (current: IncomeMonthAnswers, change: { month: string; answer: IncomeMonthAnswer | null }) => {
      const next = { ...current }
      if (change.answer) next[change.month] = change.answer
      else delete next[change.month]
      return next
    }
  )
  const [, startTransition] = useTransition()
  const [changing, setChanging] = useState(false)
  const [failed, setFailed] = useState(false)

  const onAnswer = (month: string, answer: IncomeMonthAnswer | null) => {
    setFailed(false)
    startTransition(async () => {
      applyAnswer({ month, answer })
      try {
        await setIncomeMonthAnswer(month, answer)
      } catch {
        setFailed(true)
      }
    })
  }

  const stability = incomeStability(incomeByMonth, currentMonth, optimisticAnswers)
  const gaps = incomeGaps(incomeByMonth, currentMonth, optimisticAnswers)
  const open = gaps.filter((g) => !g.answer)
  const answered = gaps.filter((g) => g.answer)
  const leftOut = answered.filter((g) => g.answer === 'not_tracked').length
  const counted = answered.length - leftOut
  const summary = [
    leftOut > 0 && `${plural(leftOut)} left out`,
    counted > 0 && `${plural(counted)} counted as $0`,
  ].filter(Boolean).join(', ')

  if (!stability && gaps.length === 0) return null

  return (
    <div className="mb-3">
      {stability && (
        <>
          <div className="flex items-center justify-between px-4 mb-1 text-caption text-text-muted">
            <span>0% Unstable</span>
            <span>100% Stable</span>
          </div>
          <div
            className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1.5 bg-bg-white shadow-card rounded-2xl sm:rounded-full px-4 py-2.5"
            title={`Compares the last ${stability.months} finished months with each other.`}
          >
            <span className="text-caption font-bold text-text-heading whitespace-nowrap">Income stability {stability.score}%</span>
            <span className="order-last sm:order-none w-full sm:w-auto sm:flex-1 h-1.5 rounded-full bg-surface-beige overflow-hidden" aria-hidden="true">
              <span className={`block h-full rounded-full ${stability.score >= 50 ? 'bg-primary-teal' : 'bg-warning'}`} style={{ width: `${stability.score}%` }} />
            </span>
            <span className="ml-auto sm:ml-0 text-caption text-text-muted whitespace-nowrap">{stability.pattern}</span>
          </div>
        </>
      )}
      {gaps.length > 0 && (
        <div className="px-4 mt-2 space-y-2">
          {open.map((gap) => <GapRow key={gap.month} gap={gap} onAnswer={onAnswer} />)}
          {changing && answered.map((gap) => <GapRow key={gap.month} gap={gap} onAnswer={onAnswer} />)}
          {answered.length > 0 && (
            <p className="text-caption text-text-muted">
              {summary},{' '}
              <button type="button" onClick={() => setChanging((c) => !c)} className="font-semibold text-primary hover:underline">
                {changing ? 'done' : 'change'}
              </button>
            </p>
          )}
          {failed && <p className="text-caption text-warning">Couldn&apos;t save that. Try again.</p>}
        </div>
      )}
    </div>
  )
}
