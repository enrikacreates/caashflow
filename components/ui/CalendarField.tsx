'use client'

import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const pad = (n: number) => String(n).padStart(2, '0')

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m: m - 1, d }
}

/** Date field with an on-brand month grid. `max` greys out later days. */
export default function CalendarField({ value, onChange, max }: { value: string; onChange: (iso: string) => void; max?: string }) {
  const [open, setOpen] = useState(false)
  const start = parts(value)
  const [view, setView] = useState({ y: start.y, m: start.m })

  const first = new Date(view.y, view.m, 1).getDay()
  const count = new Date(view.y, view.m + 1, 0).getDate()
  const shift = (by: number) => {
    const d = new Date(view.y, view.m + by, 1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }
  const label = new Date(start.y, start.m, start.d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 bg-bg-white shadow-card rounded-full px-4 py-2.5 text-caption font-semibold text-text-heading"
      >
        <CalendarDays size={15} aria-hidden="true" className="text-primary-teal" />
        {label}
      </button>
      {open && (
        <div className="mt-2 bg-bg-white shadow-card rounded-lg p-3 max-w-[300px]">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="p-1.5 text-text-muted hover:text-text-heading"><ChevronLeft size={16} /></button>
            <span className="text-caption font-bold text-text-heading">
              {new Date(view.y, view.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={() => shift(1)} aria-label="Next month" className="p-1.5 text-text-muted hover:text-text-heading"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w, i) => <span key={i} className="text-[11px] font-bold text-text-muted py-1">{w}</span>)}
            {Array.from({ length: first }, (_, i) => <span key={`gap-${i}`} />)}
            {Array.from({ length: count }, (_, i) => {
              const iso = `${view.y}-${pad(view.m + 1)}-${pad(i + 1)}`
              const selected = iso === value
              const disabled = !!max && iso > max
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange(iso); setOpen(false) }}
                  className={`h-9 rounded-full text-caption transition-colors disabled:opacity-30 ${selected ? 'bg-primary-teal text-text-inverse font-bold' : 'text-text-heading hover:bg-surface-mint'}`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
