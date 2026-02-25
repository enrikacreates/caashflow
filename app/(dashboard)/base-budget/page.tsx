import { getBaseBudgetItems } from '@/app/actions/base-budget'
import { getAccounts, getPriorityCategories } from '@/app/actions/settings'
import BaseBudgetClient from '@/components/base-budget/BaseBudgetClient'

export default async function BaseBudgetPage() {
  const [items, accounts, categories] = await Promise.all([
    getBaseBudgetItems(),
    getAccounts(),
    getPriorityCategories(),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black font-display text-ink">Base Budget Template</h1>
          <p className="text-muted text-sm mt-1">Master list of all recurring expenses</p>
        </div>
      </div>
      <BaseBudgetClient items={items} accounts={accounts ?? []} categories={categories ?? []} />
    </div>
  )
}
