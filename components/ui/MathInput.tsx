'use client'

import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import { evalMath, isPlainNumber, round2 } from '@/lib/math-input'

/**
 * Drop-in replacement for `<input type="number">` that also accepts arithmetic
 * expressions ("435-18", "100+25*2"). The user can type freely; on blur or
 * Enter the expression is evaluated and the field is replaced with the result
 * (rounded to 2 decimals). `onChange` only fires with the final numeric value,
 * so callers can keep treating it like a number input.
 *
 * Non-evaluating inputs (plain numbers) behave identically to a number field.
 */
export interface MathInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'defaultValue' | 'type'> {
  value?: number | string
  defaultValue?: number | string
  /** Fired with the resolved number after evaluation (blur / Enter). */
  onChange?: (value: number) => void
  /** Fired on every keystroke with the current raw string — optional. */
  onRawChange?: (raw: string) => void
  /** Max decimal places kept after eval (default 2). */
  decimals?: number
}

const MathInput = forwardRef<HTMLInputElement, MathInputProps>(function MathInput(
  { value, defaultValue, onChange, onRawChange, decimals = 2, onBlur, onKeyDown, ...rest },
  ref,
) {
  // Local display string — what the user is typing right now.
  const initial = value != null ? String(value) : (defaultValue != null ? String(defaultValue) : '')
  const [raw, setRaw] = useState(initial)
  // Track if the parent's controlled value diverges from our local string and
  // we should resync (e.g. server pushed an update, or a sibling control wrote it).
  const lastCommittedRef = useRef(initial)

  useEffect(() => {
    if (value == null) return
    const next = String(value)
    // Only resync if the value actually changed from our last committed snapshot —
    // don't clobber what the user is mid-typing.
    if (next !== lastCommittedRef.current) {
      setRaw(next)
      lastCommittedRef.current = next
    }
  }, [value])

  const id = useId()
  const commit = () => {
    const n = evalMath(raw)
    if (n == null) {
      // Restore last committed value if the field is empty or malformed
      setRaw(lastCommittedRef.current)
      return
    }
    const rounded = round2(n) // always 2dp for currency; decimals prop is for future flexibility
    const finalStr = String(rounded)
    setRaw(finalStr)
    lastCommittedRef.current = finalStr
    onChange?.(rounded)
  }

  return (
    <input
      ref={ref}
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      // Visual cue when the user has typed an unresolved expression
      data-math={!isPlainNumber(raw) && raw.trim() !== '' ? 'pending' : undefined}
      value={raw}
      onChange={(e) => { setRaw(e.target.value); onRawChange?.(e.target.value) }}
      onBlur={(e) => { commit(); onBlur?.(e) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur() }
        if (e.key === 'Escape') { setRaw(lastCommittedRef.current); (e.target as HTMLInputElement).blur() }
        onKeyDown?.(e)
      }}
      {...rest}
    />
  )
})

export default MathInput
