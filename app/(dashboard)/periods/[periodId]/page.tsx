import { getPeriodDetail } from '@/app/actions/periods'
import PeriodDetailClient from '@/components/period-detail/PeriodDetailClient'

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ periodId: string }>
}) {
  const { periodId } = await params
  const detail = await getPeriodDetail(periodId)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black font-display text-ink">{detail.period.period_name}</h1>
        <p className="text-muted text-sm mt-1">Manage income, deductions, and expenses for this period</p>
      </div>
      <PeriodDetailClient
        period={detail.period}
        expenses={detail.expenses}
        linkedInvoices={detail.linkedInvoices}
        manualIncome={detail.manualIncome}
        allReceivedInvoices={detail.allReceivedInvoices}
        settings={detail.settings}
      />
    </div>
  )
}
