'use client'

import { useState, useTransition } from 'react'
import { updateSettings } from '@/app/actions/settings'
import type { Settings, Account } from '@/lib/types'

export default function SettingsForm({ settings, accounts }: { settings: Settings; accounts: Account[] }) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await updateSettings(formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const inputClass = 'w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="space-y-6">

      {/* Deduction Percentages */}
      <div className="bg-bg-white rounded-lg shadow-card p-6">
        <h2 className="text-h3 font-bold text-text-heading mb-1">Deductions</h2>
        <p className="text-caption text-text-muted mb-4">
          Set each deduction&apos;s rate and the account it&apos;s set aside into. The account feeds the Account Transfers breakdown.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {([
              { pctName: 'tithe_percentage', acctName: 'tithe_account', label: 'Tithe', pct: settings.tithe_percentage, acct: settings.tithe_account },
              { pctName: 'savings_percentage', acctName: 'savings_account', label: 'Savings', pct: settings.savings_percentage, acct: settings.savings_account },
              { pctName: 'tax_percentage', acctName: 'tax_account', label: 'Tax', pct: settings.tax_percentage, acct: settings.tax_account },
              { pctName: 'profit_percentage', acctName: 'profit_account', label: 'Profit', pct: settings.profit_percentage, acct: settings.profit_account },
              { pctName: 'fun_money_percentage', acctName: 'fun_money_account', label: 'Fun Money', pct: settings.fun_money_percentage, acct: settings.fun_money_account },
            ] as const).map(({ pctName, acctName, label, pct, acct }) => (
              <div key={pctName}>
                <label className="block text-caption font-semibold text-text-heading mb-1">{label} %</label>
                <input
                  type="number"
                  name={pctName}
                  defaultValue={pct}
                  step="0.1"
                  min="0"
                  max="100"
                  className={inputClass}
                />
                <select
                  name={acctName}
                  defaultValue={acct ?? ''}
                  className={`${inputClass} mt-2 cursor-pointer`}
                >
                  <option value="">No account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Monthly Goals */}
          <div className="pt-4 border-t border-border">
            <h3 className="text-caption font-bold text-text-heading uppercase tracking-wide mb-3">Monthly Goals</h3>
            <p className="text-caption text-text-muted mb-4">
              Set intentional targets for your monthly income and recurring expenses. These drive the gauge indicators on your dashboard.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-caption font-semibold text-text-heading mb-1">
                  Income Goal <span className="text-text-muted font-normal">(monthly target)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-caption text-text-muted">$</span>
                  <input
                    type="number"
                    name="monthly_income_goal"
                    defaultValue={settings.monthly_income_goal ?? ''}
                    step="100"
                    min="0"
                    placeholder="e.g. 10000"
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-caption font-semibold text-text-heading mb-1">
                  Expense Goal <span className="text-text-muted font-normal">(monthly target)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-caption text-text-muted">$</span>
                  <input
                    type="number"
                    name="monthly_expense_goal"
                    defaultValue={settings.monthly_expense_goal ?? ''}
                    step="100"
                    min="0"
                    placeholder="e.g. 8000"
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="bg-primary-teal text-text-inverse rounded-full px-6 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? 'Saving…' : 'Save Settings'}
            </button>
            {saved && (
              <span className="text-caption font-bold text-green">Saved successfully</span>
            )}
          </div>
        </form>
      </div>

    </div>
  )
}
