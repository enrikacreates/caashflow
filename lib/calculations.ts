import type { Settings, DeductionOverrides, PeriodExpense } from './types'
import { getEffectiveAmount } from './utils'

export function getEffectivePercentage(
  overrides: DeductionOverrides | null | undefined,
  settings: Settings,
  key: keyof DeductionOverrides
): number {
  const override = overrides?.[key]
  if (override !== null && override !== undefined) return override
  const settingsKey = key as keyof Settings
  return settings[settingsKey] as number
}

export function calculateDeductions(
  income: number,
  settings: Settings,
  overrides?: DeductionOverrides | null
) {
  const titheP = getEffectivePercentage(overrides, settings, 'tithe_percentage')
  const savingsP = getEffectivePercentage(overrides, settings, 'savings_percentage')
  const taxP = getEffectivePercentage(overrides, settings, 'tax_percentage')
  const profitP = getEffectivePercentage(overrides, settings, 'profit_percentage')
  const funMoneyP = getEffectivePercentage(overrides, settings, 'fun_money_percentage')

  const tithe = income * (titheP / 100)
  const savings = income * (savingsP / 100)
  const taxes = income * (taxP / 100)
  const profit = income * (profitP / 100)
  const funMoney = income * (funMoneyP / 100)

  return {
    tithe,
    savings,
    taxes,
    profit,
    funMoney,
    total: tithe + savings + taxes + profit + funMoney,
    incomeAfterDeductions: income - tithe - savings - taxes - profit - funMoney,
    percentages: { titheP, savingsP, taxP, profitP, funMoneyP },
  }
}

export function calculatePayNowTotal(expenses: PeriodExpense[]): number {
  return expenses
    .filter((e) => e.pay_now)
    .reduce((sum, e) => sum + getEffectiveAmount(e), 0)
}

export function calculateAccountBreakdown(
  expenses: PeriodExpense[]
): Record<string, number> {
  const breakdown: Record<string, number> = {}
  expenses
    .filter((e) => e.pay_now)
    .forEach((e) => {
      const account = e.account || 'Unknown'
      breakdown[account] = (breakdown[account] || 0) + getEffectiveAmount(e)
    })
  return breakdown
}

export function getNext6Months(): string[] {
  const months: string[] = []
  const today = new Date()
  for (let i = 0; i < 6; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    months.push(`${year}-${month}`)
  }
  return months
}
