'use client'

import { useEffect, useState } from 'react'
import { evalMath, hasCents, roundUpToDollar } from '@/lib/math-input'

// Dollar fields use step="0.01" (plain inputs) or inputmode="decimal" (MathInput).
// Anything that looks like one but isn't dollars opts out with data-no-round.
const MONEY_FIELD = 'input[step="0.01"], input[inputmode="decimal"]'

function roundedFor(input: HTMLInputElement): number | null {
  const n = evalMath(input.value)
  return n != null && hasCents(n) ? roundUpToDollar(n) : null
}

function formatDollars(n: number): string {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US')}`
}

/**
 * One-tap "round up to the nearest dollar" for every money field in the app.
 * Mounted once in the dashboard layout; it floats above whichever field has
 * focus, and only when that field's value has cents.
 */
export default function RoundUpPill() {
  const [field, setField] = useState<HTMLInputElement | null>(null)
  const [rounded, setRounded] = useState<number | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target
      const isMoney =
        el instanceof HTMLInputElement &&
        el.matches(MONEY_FIELD) &&
        !el.disabled &&
        !el.readOnly &&
        !el.hasAttribute('data-no-round')
      setField(isMoney ? el : null)
    }
    const onFocusOut = () => setField(null)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  useEffect(() => {
    if (!field) return
    const sync = () => {
      const r = field.getBoundingClientRect()
      setPos({ top: r.top, left: r.right })
      setRounded(roundedFor(field))
    }
    sync()
    field.addEventListener('input', sync)
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      field.removeEventListener('input', sync)
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [field])

  if (!field || rounded == null) return null

  const apply = () => {
    // Write through the native setter so React sees a real input event. That
    // way every field works unchanged: controlled, uncontrolled, or MathInput.
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setValue?.call(field, String(rounded))
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }

  return (
    <button
      type="button"
      // Keep focus in the field so the tap doesn't blur it first
      onMouseDown={(e) => e.preventDefault()}
      onClick={apply}
      aria-label={`Round up to ${formatDollars(rounded)}`}
      style={{ top: pos.top - 4, left: pos.left, transform: 'translate(-100%, -100%)' }}
      className="fixed z-[70] rounded-full bg-text-heading text-white px-2.5 py-1 text-xs font-bold shadow-card whitespace-nowrap hover:opacity-90 transition-opacity"
    >
      ↑ {formatDollars(rounded)}
    </button>
  )
}
