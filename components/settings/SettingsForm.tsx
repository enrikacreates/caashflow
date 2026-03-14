'use client'

import { useState, useTransition } from 'react'
import { updateSettings } from '@/app/actions/settings'
import type { Settings } from '@/lib/types'

export default function SettingsForm({ settings }: { settings: Settings }) {
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
        <h2 className="text-h3 font-bold text-text-heading mb-4">Deduction Percentages</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Tithe %</label>
              <input
                type="number"
                name="tithe_percentage"
                defaultValue={settings.tithe_percentage}
                step="0.1"
                min="0"
                max="100"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Savings %</label>
              <input
                type="number"
                name="savings_percentage"
                defaultValue={settings.savings_percentage}
                step="0.1"
                min="0"
                max="100"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Tax %</label>
              <input
                type="number"
                name="tax_percentage"
                defaultValue={settings.tax_percentage}
                step="0.1"
                min="0"
                max="100"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Profit %</label>
              <input
                type="number"
                name="profit_percentage"
                defaultValue={settings.profit_percentage}
                step="0.1"
                min="0"
                max="100"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-heading mb-1">Fun Money %</label>
              <input
                type="number"
                name="fun_money_percentage"
                defaultValue={settings.fun_money_percentage}
                step="0.1"
                min="0"
                max="100"
                className={inputClass}
              />
            </div>
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
