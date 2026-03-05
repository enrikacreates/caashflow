'use client'

import { useState, useTransition } from 'react'
import { exportAllData, importData } from '@/app/actions/household'
import { seedBaseBudgetDefaults, seedBudgetRequestDefaults } from '@/app/actions/household'

export default function DataManagement() {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  const handleExport = async () => {
    startTransition(async () => {
      try {
        const data = await exportAllData()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `caashflow-export-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
        setMessage('Data exported successfully!')
      } catch {
        setMessage('Export failed')
      }
      setTimeout(() => setMessage(''), 3000)
    })
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const jsonString = ev.target?.result as string
      startTransition(async () => {
        try {
          await importData(jsonString)
          setMessage('Data imported successfully! Refresh to see changes.')
        } catch {
          setMessage('Import failed — check file format')
        }
        setTimeout(() => setMessage(''), 4000)
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSeedBudget = () => {
    if (!confirm('This will add all default budget items. Continue?')) return
    startTransition(async () => {
      await seedBaseBudgetDefaults()
      setMessage('Default budget items seeded!')
      setTimeout(() => setMessage(''), 3000)
    })
  }

  const handleSeedRequests = () => {
    if (!confirm('This will add default budget requests. Continue?')) return
    startTransition(async () => {
      await seedBudgetRequestDefaults()
      setMessage('Default requests seeded!')
      setTimeout(() => setMessage(''), 3000)
    })
  }

  return (
    <div className="bg-bg-white rounded-lg shadow-sm p-6 space-y-6">
      <h2 className="text-h3 font-bold text-text-heading">Data Management</h2>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExport}
          disabled={isPending}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Export Data (JSON)
        </button>

        <label className="bg-bg-white text-text-heading border border-border rounded-full px-5 py-2.5 text-caption font-semibold hover:border-primary cursor-pointer transition-colors">
          Import Data (JSON)
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-caption font-semibold text-text-heading mb-3">Seed Defaults</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSeedBudget}
            disabled={isPending}
            className="bg-bg-white text-text-heading border border-border rounded-full px-5 py-2.5 text-caption font-semibold hover:border-primary disabled:opacity-50 transition-colors"
          >
            Seed Base Budget Defaults
          </button>
          <button
            onClick={handleSeedRequests}
            disabled={isPending}
            className="bg-bg-white text-text-heading border border-border rounded-full px-5 py-2.5 text-caption font-semibold hover:border-primary disabled:opacity-50 transition-colors"
          >
            Seed Request Defaults
          </button>
        </div>
      </div>

      {message && (
        <div className="text-caption font-bold text-green">{message}</div>
      )}
    </div>
  )
}
