'use client'

import { useEffect, useState } from 'react'

/* -------------------------------------------------------
 * HEADER STATS
 *
 * YTD stat blobs (Earned / Spent / Owed / Saved). Fetches
 * the numbers from /api/header-stats and lays each value
 * onto its colored shape (sized to the shape's aspect).
 * ------------------------------------------------------- */
type Stats = { year: number; earned: number; spent: number; owed: number; saved: number }

type BlobKey = 'earned' | 'spent' | 'owed' | 'saved'

const BLOBS: {
  key: BlobKey
  label: string
  shape: string
  w: number
  h: number
  overlap: number // px the blob is pulled left over the previous one (tighter cluster)
  nudge?: string // vertical nudge for shapes whose visual mass isn't centered (e.g. triangle)
}[] = [
  { key: 'earned', label: 'Earned', shape: '/shapes/navshapes/Nav_Roundshape_blue.svg', w: 157, h: 107, overlap: 0 },
  { key: 'spent', label: 'Spent', shape: '/shapes/navshapes/NavPinkRoundRect.svg', w: 155, h: 84, overlap: 8 },
  { key: 'owed', label: 'Owed', shape: '/shapes/navshapes/NavOrangeTriangle.svg', w: 152, h: 100, overlap: 24, nudge: 'translate-y-[30%]' },
  { key: 'saved', label: 'Saved', shape: '/shapes/navshapes/NavYellowCircle.svg', w: 107, h: 101, overlap: 30 },
]

const fmt = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`

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

  const H = 56 // common blob height in px; each blob's width follows its natural aspect

  return (
    <div className={`flex-col items-center ${className}`}>
      <div className="flex items-center">
        {BLOBS.map((b) => {
          const w = Math.round(H * (b.w / b.h))
          return (
            <div
              key={b.key}
              className="relative flex items-center justify-center shrink-0"
              style={{ width: w, height: H, marginLeft: -b.overlap }}
            >
              <img
                src={b.shape}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full select-none pointer-events-none"
              />
              <div className={`relative text-center leading-none ${b.nudge ?? ''}`}>
                <div className="font-bold text-text-heading text-[11px] whitespace-nowrap">{fmt(stats[b.key])}</div>
                <div className="text-[7px] font-bold uppercase tracking-wide text-text-heading/70 mt-0.5">{b.label}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted text-center mt-1">
        YTD
      </div>
    </div>
  )
}
