const WINDOW_MONTHS = 6
const MIN_MONTHS = 3
const FLOOR = 5

export interface IncomeStability {
  // 5-100: 100 = the same every month, 5 = wildly different
  score: number
  label: 'Steady' | 'Some swing' | 'Up and down'
  months: number
}

/**
 * How steady income has been across the last 6 finished months that have income on record.
 * The score is 100 × (1 − standard deviation ÷ average), floored at 5. Months with nothing
 * recorded are left out: a month with no budget isn't known to be a $0 month. The current
 * month is out too, since it's still filling up. Null until there are 3 months to compare.
 */
export function incomeStability(incomeByMonth: Record<string, number>, currentMonth: string): IncomeStability | null {
  const values = Object.entries(incomeByMonth)
    .filter(([month, amount]) => month < currentMonth && amount > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-WINDOW_MONTHS)
    .map(([, amount]) => amount)
  if (values.length < MIN_MONTHS) return null

  const average = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - average) ** 2, 0) / values.length
  const score = Math.max(FLOOR, Math.round(100 * (1 - Math.sqrt(variance) / average)))
  return { score, label: score >= 80 ? 'Steady' : score >= 50 ? 'Some swing' : 'Up and down', months: values.length }
}
