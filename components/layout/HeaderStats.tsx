'use client'

import { useEffect, useState } from 'react'

/* -------------------------------------------------------
 * HEADER STATS
 *
 * YTD stat blobs (Earned / Spent / Owed / Saved). Fetches
 * the numbers from /api/header-stats and lays each value
 * onto its colored shape (sized to the shape's aspect).
 * ------------------------------------------------------- */
type Stats = { year: number; earned: number; paid: number; owed: number; saved: number }

type BlobKey = 'earned' | 'paid' | 'owed' | 'saved'

const BLOBS: {
  key: BlobKey
  label: string
  shape: string
  w: number
  h: number
  overlap: number // px the blob is pulled left over the previous one (tighter cluster)
  nudge?: string // vertical nudge for shapes whose visual mass isn't centered (e.g. triangle)
  scale?: number // per-blob size multiplier — give the narrower shapes more room around the text
}[] = [
  { key: 'earned', label: 'Earned', shape: '/shapes/navshapes/irregularblueEarned.svg', w: 125, h: 94, overlap: 0 },
  { key: 'paid', label: 'Paid', shape: '/shapes/navshapes/NavPinkRoundRect.svg', w: 155, h: 84, overlap: 8 },
  { key: 'owed', label: 'Owed', shape: '/shapes/navshapes/wonkyTriangleOwed.svg', w: 121, h: 98, overlap: 22, nudge: 'translate-y-[24%]', scale: 1.25 },
  { key: 'saved', label: 'Saved', shape: '/shapes/navshapes/NavYellowCircle.svg', w: 107, h: 101, overlap: 14, scale: 1.25 },
]

// Natural-language money: <$1k shows full ($889); <$10k rounds to whole k ($9k);
// $10k+ keeps one decimal ($15.9k), dropping a trailing ".0".
const fmt = (v: number) => {
  if (v < 1000) return `$${Math.round(v)}`
  const k = v / 1000
  return v < 10000 ? `$${Math.round(k)}k` : `$${k.toFixed(1).replace(/\.0$/, '')}k`
}

export default function HeaderStats({ className = '' }: { className?: string }) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/header-stats')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.earned === 'number') setStats(d)
      })
      .catch(() => {})
  }, [])

  if (!stats) return null

  const H = 44 // base blob height in px; each blob's width follows its natural aspect

  return (
    <div className={`flex-col items-center ${className}`}>
      <div className="flex items-center">
        {BLOBS.map((b) => {
          const bh = Math.round(H * (b.scale ?? 1))
          const w = Math.round(bh * (b.w / b.h))
          return (
            <div
              key={b.key}
              className="relative flex items-center justify-center shrink-0"
              style={{ width: w, height: bh, marginLeft: -b.overlap }}
            >
              <img
                src={b.shape}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full select-none pointer-events-none"
              />
              <div className={`relative text-center leading-none ${b.nudge ?? ''}`}>
                <div className="font-medium text-text-heading text-[15px] whitespace-nowrap">{fmt(stats[b.key])}</div>
                <div className="text-[8px] font-semibold uppercase tracking-wide text-text-heading/70 mt-0.5">{b.label}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-center -mt-3.5 relative z-10">
        <span className="bg-[#E3C7AB] rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-text-heading/75">
          YTD
        </span>
      </div>
    </div>
  )
}
