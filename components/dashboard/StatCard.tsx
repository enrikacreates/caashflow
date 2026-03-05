// components/dashboard/StatCard.tsx
// Stat card component for the dashboard — matches Figma "Container" node 1:239
// Each card has: colored accent pill (top), large dollar value, label (bottom)

interface StatCardProps {
  /** Card label, e.g. "Pay Now" */
  label: string
  /** Formatted dollar value, e.g. "$484" */
  value: string
  /** Hex or CSS var for the accent pill color — each card has its own */
  accentColor: string
  /** Optional: classname to override card size/etc */
  className?: string
}

export default function StatCard({ label, value, accentColor, className = '' }: StatCardProps) {
  return (
    <div
      className={`
        bg-bg-white rounded-lg
        shadow-[0px_12px_24px_0px_rgba(110,110,110,0.4)]
        flex flex-col justify-between
        p-6 min-h-[220px]
        ${className}
      `}
    >
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

      {/* Label */}
      <p className="font-medium text-sm leading-tight tracking-[1px] text-text-muted">
        {label}
      </p>
    </div>
  )
}
