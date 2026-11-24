/** Drag handle: a little dotted corner, like a resize grip. */
export default function DotCorner() {
  return (
    <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="2" r="1.3" />
      <circle cx="2" cy="6" r="1.3" />
      <circle cx="6" cy="6" r="1.3" />
      <circle cx="2" cy="10" r="1.3" />
      <circle cx="6" cy="10" r="1.3" />
      <circle cx="10" cy="10" r="1.3" />
    </svg>
  )
}
