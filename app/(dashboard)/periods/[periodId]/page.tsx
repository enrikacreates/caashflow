import { getPeriodDetail } from '@/app/actions/periods'
import { getPriorityCategories } from '@/app/actions/settings'
import { getBudgetRequests } from '@/app/actions/requests'
import PeriodDetailClient from '@/components/period-detail/PeriodDetailClient'

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ periodId: string }>
}) {
  const { periodId } = await params
  const [detail, categories, requests] = await Promise.all([
    getPeriodDetail(periodId),
    getPriorityCategories(),
    getBudgetRequests(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h1 font-bold text-text-heading">{detail.period.period_name}</h1>
        <p className="text-caption text-text-muted mt-1">Manage income, deductions, and expenses for this period</p>
      </div>
      <PeriodDetailClient
        period={detail.period}
        expenses={detail.expenses}
        linkedInvoices={detail.linkedInvoices}
        manualIncome={detail.manualIncome}
        allReceivedInvoices={detail.allReceivedInvoices}
        settings={detail.settings}
        accounts={detail.accounts}
        deductionContributions={detail.deductionContributions}
        adjustments={detail.adjustments}
        categories={categories ?? []}
        savingsGoals={detail.savingsGoals}
        savingsAllocations={detail.savingsAllocations}
        lastPeriodAllocations={detail.lastPeriodAllocations}
        requests={requests ?? []}
      />
    </div>
  )
}
