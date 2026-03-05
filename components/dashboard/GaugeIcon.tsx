/* -------------------------------------------------------
 * GAUGE ICON
 *
 * Inline SVG speedometer with a real arrow-shaped needle.
 * The needle rotates around the gauge pivot via CSS transform.
 *
 * angle:  -80 = full left (danger / over budget)
 *           0 = center (neutral)
 *         +80 = full right (healthy / under budget)
 *
 * color:  use the GAUGE_COLORS export for semantic meaning
 * ------------------------------------------------------- */

/** Semantic needle palette — use these rather than raw hex */
export const GAUGE_COLORS = {
  /** Healthy / on track / positive */
  green: '#68D391',
  /** Caution / mid-range — warm amber */
  amber: '#F6C347',
  /** Over budget / warning — soft coral-pink (not harsh red) */
  red: '#F4908D',
  /** No signal / neutral */
  neutral: '#C1BCBC',
} as const

interface GaugeIconProps {
  /** -80 (full left) to +80 (full right), 0 = center */
  angle?: number
  /** Use GAUGE_COLORS constants, or any CSS color */
  color?: string
}

export default function GaugeIcon({ angle = 0, color = GAUGE_COLORS.neutral }: GaugeIconProps) {
  // Gauge pivot = bottom-center of the inner white arc
  const px = 68.5
  const py = 58

  // Arrow shape is 14 × 35px; its rounded pivot cap sits at ≈ (7, 34).
  // We scale it to 1.2× in Y (lengthens without thinning) so the
  // effective pivot cap is at (7, 40.8). Translate so that cap lands on (px, py).
  const tx = px - 7        // 61.5 — centers horizontally on pivot
  const ty = py - 40.8     // 17.2 — aligns pivot cap to gauge pivot

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

      {/* Dynamic needle — arrow shape rotates around gauge pivot
          The <g> handles the animated rotation; the <path> inside is
          statically positioned so its pivot cap sits at (px, py) */}
      <g
        style={{
          transformOrigin: `${px}px ${py}px`,
          transform: `rotate(${angle}deg)`,
          transition: 'transform 0.6s ease-out',
        }}
      >
        <path
          transform={`translate(${tx}, ${ty}) scale(1, 1.2)`}
          d="M1.0792 29.2212C1.14144 30.8522 1.8485 32.3074 3.17701 33.2444C4.49785 34.1827 6.33163 34.526 8.14276 34.221C9.95388 33.9159 11.556 32.9941 12.4644 31.6803C13.3805 30.3653 13.5281 28.7662 13.0071 27.2124C13.0071 27.2124 13.0071 27.2124 13.0071 27.2124C12.8649 26.7856 12.7227 26.3588 12.5805 25.932C10.0208 18.2494 7.46112 10.5669 4.90142 2.88431C4.75921 2.4575 4.61701 2.03069 4.4748 1.60388C4.30538 1.09862 3.91345 0.652701 3.42822 0.356971C2.94049 0.0616638 2.39931 -0.0592447 1.88075 0.0280853C1.36218 0.115413 0.896349 0.405911 0.542734 0.842907C0.191616 1.27948 -0.0184182 1.82678 0.00182358 2.35716C0.00182358 2.35716 0.00182358 2.35716 0.00182358 2.35716C0.0197803 2.8049 0.037736 3.25262 0.0556921 3.70036C0.378904 11.7596 0.702115 19.8188 1.02533 27.878C1.04328 28.3257 1.06124 28.7734 1.0792 29.2212Z"
          style={{ fill: color, transition: 'fill 0.4s ease' }}
        />
      </g>

      {/* Bottom baseline */}
      <path
        d="M14.7646 61.7197H119.657"
        stroke="#C1BCBC" strokeWidth="1.91875"
      />
    </svg>
  )
}
