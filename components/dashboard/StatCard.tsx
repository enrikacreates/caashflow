// components/dashboard/StatCard.tsx
// Stat card component for the dashboard — matches Figma "Container" node 1:239
// Each card has: gauge icon (top), colored accent pill with value, label (bottom)

import GaugeIcon from '@/components/dashboard/GaugeIcon'

interface StatCardProps {
  /** Card label, e.g. "Pay Now" */
  label: string
  /** Formatted dollar value, e.g. "$484" */
  value: string
  /** Hex or CSS var for the accent pill color — each card has its own */
  accentColor: string
  /** Gauge needle angle: -80 (full left / bad) to +80 (full right / healthy), 0 = center */
  gaugeAngle?: number
  /** Gauge needle + pivot dot color — any CSS color or CSS var */
  gaugeColor?: string
  /** Optional contextual line below the label, e.g. "of $10K goal" */
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
  subtitle,
  className = '',
}: StatCardProps) {
  return (
    <div
      className={`
        bg-bg-white rounded-lg
        shadow-[0px_12px_24px_0px_rgba(110,110,110,0.4)]
        flex flex-col justify-between
        p-5
        ${className}
      `}
    >
      {/* Gauge icon — needle animates to reflect card health */}
      <div className="mb-2 -mx-1">
        <GaugeIcon angle={gaugeAngle} color={gaugeColor} />
      </div>

      {/* Accent pill with value overlaid on top */}
      <div className="relative overflow-hidden">
        <div
          className="h-20 w-full rounded-[44px]"
          style={{ backgroundColor: accentColor }}
        />
        <p className="absolute inset-0 flex items-center justify-center font-bold text-[38px] leading-none text-text-heading whitespace-nowrap tabular-nums px-3">
          {value}
        </p>
      </div>

      {/* Label + optional context subtitle */}
      <div className="mt-3">
        <p className="text-caption font-semibold text-text-muted uppercase tracking-wide">
          {label}
        </p>
        {subtitle && (
          <p className="text-[11px] text-text-muted mt-0.5 leading-tight">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}
