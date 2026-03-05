import { getBaseBudgetItems } from '@/app/actions/base-budget'
import { getAccounts, getPriorityCategories, getSettings } from '@/app/actions/settings'
import { calculateMonthlyEquivalent } from '@/lib/calculations'
import { formatCurrency } from '@/lib/utils'
import BaseBudgetClient from '@/components/base-budget/BaseBudgetClient'

export default async function BaseBudgetPage() {
  const [items, accounts, categories, settings] = await Promise.all([
    getBaseBudgetItems(),
    getAccounts(),
    getPriorityCategories(),
    getSettings(),
  ])

  const normalizedMonthlyTotal = calculateMonthlyEquivalent(items)
  const goal = settings.monthly_expense_goal
  const diff = goal !== null ? normalizedMonthlyTotal - goal : null

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 font-bold text-text-heading">Base Budget Template</h1>
          <p className="text-body text-text-muted mt-1">Master list of all recurring expenses</p>
        </div>

        {/* Monthly equivalent summary + goal diff */}
        <div className="text-right shrink-0 ml-6">
          {diff !== null && (
            <p
              className="text-caption font-bold mb-0.5"
              style={{ color: diff > 0 ? '#F4908D' : '#68D391' }}
            >
              {diff > 0
                ? `+${formatCurrency(diff)} over goal`
                : `${formatCurrency(Math.abs(diff))} under goal`}
            </p>
          )}
          <p className="text-h2 font-bold text-text-heading">{formatCurrency(normalizedMonthlyTotal)}</p>
          <p className="text-caption text-text-muted">
            {goal !== null ? `of ${formatCurrency(goal)} goal` : 'monthly equivalent'}
          </p>
        </div>
      </div>

      <BaseBudgetClient items={items} accounts={accounts ?? []} categories={categories ?? []} />
    </div>
  )
}
