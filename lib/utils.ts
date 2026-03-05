export function formatCurrencyShort(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0'
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    return `${sign}$${m % 1 === 0 ? m : m.toFixed(1)}M`
  }
  if (abs >= 1000) {
    const k = abs / 1000
    return `${sign}$${k % 1 === 0 ? k : k.toFixed(1)}K`
  }
  return `${sign}$${Math.round(abs)}`
}

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

// Ordered pill color classes — used for deterministic "random" coloring
const PILL_COLORS = [
  'bg-pill-lavender text-text-heading',
  'bg-pill-peach text-text-heading',
  'bg-pill-cyan-light text-text-heading',
  'bg-pill-yellow text-text-heading',
  'bg-pill-blue text-text-heading',
  'bg-pill-teal text-text-heading',
  'bg-pill-green text-text-heading',
  'bg-pill-mauve text-text-heading',
  'bg-pill-coral text-text-heading',
  'bg-pill-tan text-text-heading',
  'bg-pill-pink text-text-heading',
  'bg-pill-cyan text-text-heading',
]

/** Hash a string to a consistent pill color class — same string always gets same color */
export function getPillColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PILL_COLORS[Math.abs(hash) % PILL_COLORS.length]
}

export const COLOR_KEY_MAP: Record<string, string> = {
  green:  'bg-pill-green text-text-heading',
  blue:   'bg-pill-blue text-text-heading',
  orange: 'bg-pill-coral text-text-heading',
  yellow: 'bg-pill-yellow text-text-heading',
  muted:  'bg-surface-gray text-text-muted',
  rosy:   'bg-surface-pink text-text-heading',
  blush:  'bg-pill-pink text-text-heading',
  purple: 'bg-pill-lavender text-text-heading',
  teal:   'bg-pill-teal text-text-heading',
}

export const COLOR_KEYS = Object.keys(COLOR_KEY_MAP)

export function getPriorityColor(colorKey: string | null | undefined): string {
  return colorKey ? COLOR_KEY_MAP[colorKey] || 'bg-surface-gray text-text-muted' : 'bg-surface-gray text-text-muted'
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending:   'bg-pill-yellow text-text-heading',
    approved:  'bg-pill-blue text-text-heading',
    purchased: 'bg-pill-green text-text-heading',
    projected: 'bg-pill-mauve text-text-heading',
    sent:      'bg-pill-cyan text-text-heading',
    received:  'bg-pill-green text-text-heading',
    requested: 'bg-pill-peach text-text-heading',
  }
  return map[status] || 'bg-surface-gray text-text-muted'
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
