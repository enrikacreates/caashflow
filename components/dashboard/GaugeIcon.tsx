/* -------------------------------------------------------
 * GAUGE ICON
 *
 * Inline SVG speedometer gauge with a dynamic needle.
 * The needle rotates around the gauge's pivot point via
 * CSS transform so it can animate smoothly.
 *
 * angle:  -80 = full left (danger / over budget)
 *           0 = center (neutral)
 *         +80 = full right (healthy / under budget)
 *
 * color:  any CSS color string or CSS variable
 *         e.g. '#F87272', 'var(--color-mint)', '#68D391'
 * ------------------------------------------------------- */

interface GaugeIconProps {
  /** -80 (full left) to +80 (full right), 0 = center */
  angle?: number
  /** Needle + pivot dot color */
  color?: string
}

export default function GaugeIcon({ angle = 0, color = '#C1BCBC' }: GaugeIconProps) {
  // Pivot point = bottom-center of the inner arc
  const px = 68.5
  const py = 58

  return (
    <svg
      width="100%"
      viewBox="0 0 138 68"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer shell */}
      <path
        d="M137.022 47.7854C137.022 74.1766 133.401 66.1893 68.5111 66.1893C0 66.1893 0 74.1766 0 47.7854C0 21.3943 30.6735 0 68.5111 0C106.349 0 137.022 21.3943 137.022 47.7854Z"
        fill="#EFEFEF"
      />

      {/* Inner face */}
      <path
        d="M123.139 50.9559C123.139 71.9658 120.252 65.6072 68.5116 65.6072C13.8838 65.6072 13.8838 71.9658 13.8838 50.9559C13.8838 29.946 38.3415 12.9141 68.5116 12.9141C98.6817 12.9141 123.139 29.946 123.139 50.9559Z"
        fill="white"
      />

      {/* Right tick mark */}
      <line
        y1="-1.43714" x2="16.7486" y2="-1.43714"
        transform="matrix(0.468522 -0.883452 0.854865 0.51885 95.3721 58.0615)"
        stroke="#C1BCBC" strokeWidth="2.87428"
      />

      {/* Left tick mark */}
      <line
        y1="-1.43714" x2="16.7486" y2="-1.43714"
        transform="matrix(-0.468522 -0.883452 -0.854865 0.51885 42.2529 58.0615)"
        stroke="#C1BCBC" strokeWidth="2.87428"
      />

      {/* Dynamic needle — rotates around pivot via CSS transform */}
      <line
        x1={px}
        y1={py}
        x2={px}
        y2={py - 32}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{
          stroke: color,
          transformOrigin: `${px}px ${py}px`,
          transform: `rotate(${angle}deg)`,
          transition: 'transform 0.6s ease-out, stroke 0.4s ease',
        }}
      />

      {/* Pivot dot */}
      <circle
        cx={px}
        cy={py}
        r="3.5"
        style={{ fill: color, transition: 'fill 0.4s ease' }}
      />

      {/* Bottom baseline */}
      <path
        d="M14.7646 61.7197H119.657"
        stroke="#C1BCBC" strokeWidth="1.91875"
      />
    </svg>
  )
}
