// components/dashboard/StatCard.tsx
// Stat card component for the dashboard
// Layout: gauge (health indicator) → label row (dot + icon + text) → value → subtitle

import type { LucideIcon } from 'lucide-react'
import GaugeIcon from '@/components/dashboard/GaugeIcon'

interface StatCardProps {
  /** Card label, e.g. "Pay Now" */
  label: string
  /** Formatted dollar value, e.g. "$484" */
  value: string
  /** Hex or CSS var — used as small accent dot beside label */
  accentColor: string
  /** Gauge needle angle: -80 (full left / bad) to +80 (full right / healthy), 0 = center */
  gaugeAngle?: number
  /** Gauge needle color — any CSS color or CSS var */
  gaugeColor?: string
  /** Optional Lucide icon beside label */
  icon?: LucideIcon
  /** Optional contextual line below the value, e.g. "of $10K goal" */
  subtitle?: string
  /** Optional: classname to override card size/etc */
  className?: string
}

export default function StatCard({
  label,
  value,
  accentColor,
  gaugeAngle = 0,
  gaugeColor = '#C1BCBC',
  icon: Icon,
  subtitle,
  className = '',
}: StatCardProps) {
  return (
    <div
      className={`
        bg-bg-white rounded-lg
        shadow-card
        flex flex-col
        p-5
        ${className}
      `}
    >
      {/* Gauge icon — needle reflects card health */}
      <div className="-mx-1 mb-3">
        <GaugeIcon angle={gaugeAngle} color={gaugeColor} />
      </div>

      {/* Label row: colored dot + optional icon + label text */}
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        {Icon && <Icon size={11} className="text-text-muted" />}
        <span className="text-caption font-bold uppercase tracking-wide text-text-muted leading-none">
          {label}
        </span>
      </div>

      {/* Value — clean on white background */}
      <p className="text-h2 font-bold text-text-heading leading-none tabular-nums">
        {value}
      </p>

      {/* Optional context subtitle */}
      {subtitle && (
        <p className="text-[11px] text-text-muted mt-1 leading-tight">
          {subtitle}
        </p>
      )}
    </div>
  )
}
