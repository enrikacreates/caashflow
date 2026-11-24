/**
 * Tiny pub-sub toast notifier.
 *
 * Used to surface "Couldn't save — reverted" when an optimistic UI update is
 * rejected by the server. Any client component can call notify()/notifyError();
 * a single <ToastHost /> mounted in the dashboard layout renders the stack.
 *
 * Keeping this dep-free instead of pulling in sonner/react-hot-toast — payloads
 * are tiny, requirements are minimal (a 3s flash near the bottom).
 */

export type ToastKind = 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  // Optional button, e.g. Undo; tapping it runs and dismisses the toast
  action?: { label: string; run: () => void }
}

type Listener = (toasts: Toast[]) => void

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<Listener>()

const emit = () => listeners.forEach((l) => l(toasts))

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  listener(toasts)
  return () => { listeners.delete(listener) }
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

function push(kind: ToastKind, message: string, ttlMs: number, action?: Toast['action']) {
  const id = nextId++
  toasts = [...toasts, { id, kind, message, action }]
  emit()
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id)
      emit()
    }, ttlMs)
  }
}

export function notify(message: string, ttlMs = 2500) {
  push('info', message, ttlMs)
}

export function notifyError(message: string = "Couldn't save — reverted.", ttlMs = 3500) {
  push('error', message, ttlMs)
}

/* ── Undo history: the corner Undo button steps back through recent actions ── */

export interface UndoEntry {
  id: number
  message: string
  run: () => void
}

const UNDO_LIMIT = 10
let undoStack: UndoEntry[] = []
let nextUndoId = 1
const undoListeners = new Set<(stack: UndoEntry[]) => void>()
const emitUndo = () => undoListeners.forEach((l) => l(undoStack))

export function subscribeUndo(listener: (stack: UndoEntry[]) => void): () => void {
  undoListeners.add(listener)
  listener(undoStack)
  return () => { undoListeners.delete(listener) }
}

/** Undo the most recent action still in the history. */
export function undoLast() {
  const entry = undoStack[undoStack.length - 1]
  if (!entry) return
  undoStack = undoStack.slice(0, -1)
  emitUndo()
  entry.run()
}

/** Forget the history, e.g. on leaving the page whose actions it holds. */
export function clearUndo() {
  if (undoStack.length === 0) return
  undoStack = []
  emitUndo()
}

/**
 * A short note with an Undo button, for one-tap actions that are easy to hit by mistake.
 * The action also joins the history behind the corner Undo button; undoing from either
 * place removes it from both.
 */
export function notifyUndo(message: string, undo: () => void, ttlMs = 8000) {
  const entry: UndoEntry = { id: nextUndoId++, message, run: undo }
  undoStack = [...undoStack, entry].slice(-UNDO_LIMIT)
  emitUndo()
  push('info', message, ttlMs, {
    label: 'Undo',
    run: () => {
      if (!undoStack.some((e) => e.id === entry.id)) return
      undoStack = undoStack.filter((e) => e.id !== entry.id)
      emitUndo()
      undo()
    },
  })
}
