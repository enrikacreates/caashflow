'use client'

import { useEffect, useState } from 'react'

interface Label {
  text: string
  title: string | null
  left: number
  width: number
  align: string
}

interface Layout {
  top: number
  left: number
  width: number
  scrollLeft: number
  labels: Label[]
}

/**
 * A copy of a table's column titles pinned under the summary bar whenever the real ones
 * have scrolled out of view, wherever you are on the page. The table scrolls sideways in
 * its own box, which stops CSS sticky from reaching the page, so this follows both scrolls.
 * Tapping a title sorts, like tapping the real one.
 */
export default function FloatingColumnLabels({ boxRef }: { boxRef: React.RefObject<HTMLDivElement | null> }) {
  const [layout, setLayout] = useState<Layout | null>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let frame = 0

    const measure = () => {
      frame = 0
      const thead = box.querySelector('thead')
      const ths = thead ? [...thead.querySelectorAll('th')] : []
      if (!thead || ths.length === 0) { setLayout(null); return }

      // Pin just under the budget's summary bar (or the top of the screen without one)
      const bar = document.querySelector('.under-chrome')
      const top = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0
      const boxRect = box.getBoundingClientRect()
      // Measure a title cell, not the header row: the cells stick to the top of the table's
      // own scroll box, while the row itself scrolls away inside it
      const headRect = ths[0].getBoundingClientRect()
      const hidden = headRect.top < top - 1
      // Only while some of the table's rows are still on screen below the bar
      const rowsShowing = boxRect.bottom > top + headRect.height + 24
      if (!hidden || !rowsShowing) { setLayout(null); return }

      const tableLeft = box.querySelector('table')!.getBoundingClientRect().left
      setLayout({
        top,
        left: boxRect.left,
        width: boxRect.width,
        scrollLeft: box.scrollLeft,
        labels: ths
          .filter((th) => th.offsetWidth > 0)
          .map((th) => {
            const r = th.getBoundingClientRect()
            return {
              text: th.innerText.trim(),
              title: th.getAttribute('title'),
              left: r.left - tableLeft,
              width: r.width,
              align: getComputedStyle(th).textAlign,
            }
          }),
      })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule)
    box.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(schedule)
    observer.observe(box)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      box.removeEventListener('scroll', schedule)
      observer.disconnect()
    }
  }, [boxRef])

  if (!layout) return null

  const sortBy = (index: number) => {
    const ths = [...(boxRef.current?.querySelectorAll('thead th') ?? [])].filter((th) => (th as HTMLElement).offsetWidth > 0)
    ;(ths[index] as HTMLElement | undefined)?.click()
  }

  return (
    <div
      aria-hidden="true"
      className="fixed z-30 overflow-hidden bg-bg-white border-b border-[#e9e9e9] shadow-[0_2px_4px_rgba(0,0,0,0.05)] rounded-b-lg"
      style={{ top: layout.top, left: layout.left, width: layout.width, height: 30 }}
    >
      <div className="relative h-full" style={{ transform: `translateX(${-layout.scrollLeft}px)` }}>
        {layout.labels.map((label, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            title={label.title ?? undefined}
            onClick={() => sortBy(i)}
            className="absolute top-0 h-full px-1.5 flex items-center text-[11px] font-bold uppercase text-text-muted whitespace-nowrap hover:text-text-heading"
            style={{
              left: label.left,
              width: label.width,
              justifyContent: label.align === 'center' ? 'center' : label.align === 'right' ? 'flex-end' : 'flex-start',
            }}
          >
            {label.text}
          </button>
        ))}
      </div>
    </div>
  )
}
