'use client'

import { useState, useRef, useEffect } from 'react'

export default function Combobox({
  name, defaultValue = '', options, placeholder, className,
}: {
  name: string
  defaultValue?: string
  options: string[]
  placeholder?: string
  className?: string
}) {
  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const q = value.trim().toLowerCase()
  const filtered = options.filter((o) => o.toLowerCase().includes(q) && o.toLowerCase() !== q)

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        name={name}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => { setValue(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className={className}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-bg-white border border-border rounded-sm shadow-card max-h-48 overflow-auto">
          {filtered.map((o) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setValue(o); setOpen(false) }}
                className="w-full text-left px-4 py-2 text-caption text-text-heading hover:bg-[#ebf0f0] transition-colors"
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
