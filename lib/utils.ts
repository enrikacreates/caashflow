export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const COLOR_KEY_MAP: Record<string, string> = {
  green: 'bg-green text-white',
  blue: 'bg-blue text-white',
  orange: 'bg-orange text-white',
  muted: 'bg-muted text-white',
  rosy: 'bg-rosy text-white',
  blush: 'bg-blush text-muted',
  purple: 'bg-purple text-white',
  teal: 'bg-teal text-white',
}

export const COLOR_KEYS = Object.keys(COLOR_KEY_MAP)

export function getPriorityColor(colorKey: string | null | undefined): string {
  return colorKey ? COLOR_KEY_MAP[colorKey] || 'bg-line text-ink' : 'bg-line text-ink'
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow text-ink',
    approved: 'bg-blue text-white',
    purchased: 'bg-green text-white',
    projected: 'bg-rosy text-white',
    sent: 'bg-blue text-white',
    received: 'bg-green text-white',
    requested: 'bg-orange text-white',
  }
  return map[status] || 'bg-line text-ink'
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function getEffectiveAmount(expense: {
  amount_override: number | null
  default_amount: number
  paid_amount?: number
}): number {
  // paid_amount > 0 is the final word — it's what you're actually paying
  if (expense.paid_amount && expense.paid_amount > 0) return expense.paid_amount
  return expense.amount_override !== null && expense.amount_override !== undefined
    ? expense.amount_override
    : expense.default_amount
}

/** The "owed" amount before paid_amount override (amount_override ?? default_amount) */
export function getOwedAmount(expense: {
  amount_override: number | null
  default_amount: number
}): number {
  return expense.amount_override !== null && expense.amount_override !== undefined
    ? expense.amount_override
    : expense.default_amount
}
