/** Thin-line cup pouring out: Auto Fill. Matches the lucide stroke weight. */
export default function PourIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <g transform="rotate(-40 14 9)">
        <path d="M9 3h10l-1.3 10.2A2 2 0 0 1 15.7 15h-3.4a2 2 0 0 1-2-1.8Z" />
        <path d="M9.6 7.5h8.8" />
      </g>
      <path d="M6.4 9.6c-1.6 1.6-1.9 4.5-1.4 7" />
      <path d="M5 19.6v.2" />
      <path d="M4 22h8" />
    </svg>
  )
}
