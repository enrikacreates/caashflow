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

export function getPriorityClass(category: string | null | undefined): string {
  if (!category) return ''
  const match = category.match(/P\d/)
  return match ? match[0].toLowerCase() : ''
}

export function getPriorityColor(category: string | null | undefined): string {
  const map: Record<string, string> = {
    'P0: Lifeline': 'bg-green text-white',
    'P1: Essentials': 'bg-blue text-white',
    'P3: Debt': 'bg-orange text-white',
    'P4: Business | Education': 'bg-muted text-white',
    'P5: Lifestyle': 'bg-rosy text-white',
    'P7: UpNext': 'bg-blush text-muted',
  }
  return category ? map[category] || 'bg-line text-ink' : 'bg-line text-ink'
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
}): number {
  return expense.amount_override !== null && expense.amount_override !== undefined
    ? expense.amount_override
    : expense.default_amount
}
