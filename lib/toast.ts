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

function push(kind: ToastKind, message: string, ttlMs: number) {
  const id = nextId++
  toasts = [...toasts, { id, kind, message }]
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
