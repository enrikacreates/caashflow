const WINDOW_MONTHS = 6
const MIN_MONTHS = 3

export type IncomePattern = 'Steady' | 'Steady with spikes' | 'High highs, low lows' | 'Few and far' | 'Up and down'

/** What a finished month with no income really was. Keyed YYYY-MM in settings. */
export type IncomeMonthAnswer = 'not_tracked' | 'no_earnings'
export type IncomeMonthAnswers = Record<string, IncomeMonthAnswer>

export interface IncomeStability {
  // 0-100: 100 = the same every month, 0 = months differ as much as the average itself or more
  score: number
  pattern: IncomePattern
  // Months that counted toward the score
  months: number
}

export interface IncomeGap {
  month: string
  answer: IncomeMonthAnswer | null
}

function monthsBack(month: string, count: number): string[] {
  const [y, m] = month.split('-').map(Number)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - i), 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

/** The last 6 finished months, skipping any before the first income on record, so a new family isn't asked about them. */
function windowMonths(incomeByMonth: Record<string, number>, currentMonth: string): string[] {
  const firstMonth = Object.keys(incomeByMonth)
    .filter((month) => incomeByMonth[month] > 0)
    .sort()[0]
  if (!firstMonth) return []
  return monthsBack(currentMonth, WINDOW_MONTHS).filter((month) => month >= firstMonth)
}

/** Months in the window with no income, and how each was answered. Adding income later removes a month from this list. */
export function incomeGaps(
  incomeByMonth: Record<string, number>,
  currentMonth: string,
  answers: IncomeMonthAnswers = {}
): IncomeGap[] {
  return windowMonths(incomeByMonth, currentMonth)
    .filter((month) => !(incomeByMonth[month] > 0))
    .map((month) => ({ month, answer: answers[month] ?? null }))
}

/** The shape of income, from how the months differ from each other. First match wins. */
function incomePattern(values: number[], score: number, average: number): IncomePattern {
  const emptyMonths = values.filter((v) => v === 0).length
  if (score >= 80) return 'Steady'
  if (emptyMonths * 2 >= values.length) return 'Few and far'

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const isNear = (v: number) => Math.abs(v - median) <= median * 0.25
  const near = values.filter(isNear).length
  const onlyHighOutliers = values.every((v) => isNear(v) || v > median)
  if (median > 0 && near >= 2 && near >= values.length - 2 && onlyHighOutliers) return 'Steady with spikes'

  if (sorted[sorted.length - 1] >= average * 1.5 && sorted[0] <= average * 0.5) return 'High highs, low lows'
  return 'Up and down'
}

/**
 * How stable income has been across the last 6 finished months, comparing the months with
 * each other. The score is 100 × (1 − standard deviation ÷ average), floored at 0. A month
 * with no income counts as $0 only once it's been answered "no earnings"; "not tracked" and
 * unanswered months are left out, so an open question can't lower the score. The current
 * month is out, since it's still filling up. Null until there are 3 months to compare.
 */
export function incomeStability(
  incomeByMonth: Record<string, number>,
  currentMonth: string,
  answers: IncomeMonthAnswers = {}
): IncomeStability | null {
  const values = windowMonths(incomeByMonth, currentMonth)
    .filter((month) => incomeByMonth[month] > 0 || answers[month] === 'no_earnings')
    .map((month) => (incomeByMonth[month] > 0 ? incomeByMonth[month] : 0))
  if (values.length < MIN_MONTHS) return null

  const average = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - average) ** 2, 0) / values.length
  const score = average > 0 ? Math.max(0, Math.round(100 * (1 - Math.sqrt(variance) / average))) : 0
  return { score, pattern: incomePattern(values, score, average), months: values.length }
}
