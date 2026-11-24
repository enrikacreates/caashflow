/**
 * Pointer drag-to-reorder for a list of rows marked with data-drag-id. Works with a mouse
 * or a finger. The window follows the pointer rather than the grip, because moving a row
 * can move the grip's own element, which drops pointer capture and loses the release.
 *
 * `ids` is the current order of the rows that may trade places (one group). `onPreview`
 * gets each new order while dragging; `onDrop` gets the final order and the starting one
 * (only called when something actually moved).
 */
export function startDragReorder(
  e: { preventDefault: () => void },
  id: string,
  ids: string[],
  container: HTMLElement,
  onPreview: (order: string[]) => void,
  onDrop: (order: string[], startOrder: string[]) => void,
  onEnd?: () => void
) {
  e.preventDefault()
  const startOrder = [...ids]
  let order = startOrder

  const move = (ev: PointerEvent) => {
    const rows = order
      .map((rid) => container.querySelector<HTMLElement>(`[data-drag-id="${CSS.escape(rid)}"]`))
      .filter((el): el is HTMLElement => !!el)
    if (rows.length !== order.length) return
    const over = rows.findIndex((el) => {
      const box = el.getBoundingClientRect()
      return ev.clientY < box.top + box.height / 2
    })
    // Insertion point in the current order; past the last midpoint means the very end
    const target = over === -1 ? rows.length : over
    const from = order.indexOf(id)
    const to = target > from ? target - 1 : target
    if (from === -1 || from === to) return
    const next = [...order]
    next.splice(from, 1)
    next.splice(to, 0, id)
    order = next
    onPreview(next)
  }

  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    onEnd?.()
    if (order.join() !== startOrder.join()) onDrop(order, startOrder)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
