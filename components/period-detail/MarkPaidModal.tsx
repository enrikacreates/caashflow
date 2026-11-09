'use client'

import { useState, useTransition } from 'react'
import { markBillPaid } from '@/app/actions/period-expenses'
import { notifyError } from '@/lib/toast'
import { evalMath } from '@/lib/math-input'
import { localToday } from '@/lib/sessions'
import { smallConfetti, bigConfetti } from '@/lib/confetti'
import MathInput from '@/components/ui/MathInput'
import CalendarField from '@/components/ui/CalendarField'
import type { Account } from '@/lib/types'

function monthsAround(center: string): string[] {
  const [y, m] = center.split('-').map(Number)
  return [-1, 0, 1].map((by) => {
    const d = new Date(y, m - 1 + by, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/** Record a bill as paid without budgeting it: date, amount, account, optional month and note. */
export default function MarkPaidModal({
  expenseId, baseItemId, name, amount, account, accounts, defaultDate, billMonth, onClose, onMarked,
}: {
  expenseId?: string
  baseItemId?: string
  name: string
  amount: number
  account: string | null
  accounts: Account[]
  defaultDate?: string
  // The month this bill belongs to; a baseline bill has no budget line, so it must keep a month
  billMonth?: string
  onClose: () => void
  // Applies the result on screen right away; `month` is the month it was recorded for
  onMarked?: (month: string | null) => void
}) {
  const [, startTransition] = useTransition()
  const today = localToday()
  const [paidOn, setPaidOn] = useState(defaultDate && defaultDate <= today ? defaultDate : today)
  const [amountRaw, setAmountRaw] = useState(String(amount))
  const [chosenAccount, setChosenAccount] = useState(account)
  const [forMonth, setForMonth] = useState<string | null>(billMonth ?? null)
  const [note, setNote] = useState('')
  const months = monthsAround(billMonth ?? today.slice(0, 7))
  const accountNames = [...new Set([...accounts.map((a) => a.name), ...(account ? [account] : [])])]
  const resolved = evalMath(amountRaw)
  const valid = resolved != null && resolved > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || resolved == null) return
    // Close first: the bill leaves the list right away and a second tap has nothing to hit
    onClose()
    startTransition(async () => {
      onMarked?.(forMonth)
      try {
        const res = await markBillPaid({ expenseId, baseItemId, name, amount: resolved, account: chosenAccount, paidOn, forMonth, note })
        if (res.savingsAchieved) await bigConfetti()
        else if (res.exceedsMinimum || res.savingsExceedsMonthly) await smallConfetti()
      } catch (err) {
        notifyError(err instanceof Error ? err.message : 'Could not record that payment. Please try again.')
      }
    })
  }

  const chip = (on: boolean) =>
    `rounded-full px-3.5 py-2 text-caption font-semibold transition-colors ${on ? 'bg-primary-teal text-text-inverse' : 'bg-bg-white shadow-card text-text-muted hover:text-text-heading'}`
  const label = 'block text-caption font-semibold text-text-heading mb-2'

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-cream rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-h3 font-bold text-text-heading">Mark {name} paid</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text-heading text-xl transition-colors">✕</button>
        </div>
        <p className="text-caption text-text-muted mb-5">Paid outside a budget, so it won&apos;t count against any session&apos;s money.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <span className={label}>Date paid</span>
            <CalendarField value={paidOn} onChange={setPaidOn} max={today} />
          </div>

          <div>
            <label className={label}>Amount</label>
            <MathInput
              defaultValue={amount}
              onChange={(n) => setAmountRaw(String(n))}
              onRawChange={setAmountRaw}
              className="w-40 bg-bg-white rounded-full shadow-card px-4 py-2.5 text-caption font-semibold focus:outline-none"
            />
          </div>

          {accountNames.length > 0 && (
            <div>
              <span className={label}>Paid from</span>
              <div className="flex flex-wrap gap-2">
                {accountNames.map((a) => (
                  <button key={a} type="button" aria-pressed={chosenAccount === a} onClick={() => setChosenAccount(a)} className={chip(chosenAccount === a)}>{a}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className={label}>For which month</span>
            <div className="flex flex-wrap gap-2">
              {months.map((m) => (
                <button key={m} type="button" aria-pressed={forMonth === m} onClick={() => setForMonth(m)} className={chip(forMonth === m)}>{monthLabel(m)}</button>
              ))}
              {expenseId && (
                <button type="button" aria-pressed={forMonth === null} onClick={() => setForMonth(null)} className={chip(forMonth === null)}>Skip</button>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="paid-note" className={label}>Note <span className="font-normal text-text-muted">(optional)</span></label>
            <textarea
              id="paid-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Paid from the card on the phone"
              className="w-full bg-bg-white rounded-lg shadow-card px-4 py-2.5 text-caption focus:outline-none resize-y"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="bg-bg-white shadow-card text-text-heading rounded-full px-5 py-2.5 text-caption font-semibold">Cancel</button>
            <button type="submit" disabled={!valid} className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">Mark paid</button>
          </div>
        </form>
      </div>
    </div>
  )
}
