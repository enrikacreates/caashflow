import { getInvoices } from '@/app/actions/invoices'
import InvoicesClient from '@/components/invoices/InvoicesClient'

export default async function CashFlowPage() {
  const invoices = await getInvoices()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black font-display text-ink">Cash Flow & Invoices</h1>
        <p className="text-muted text-sm mt-1">Track income and project cash flow</p>
      </div>
      <InvoicesClient invoices={invoices} />
    </div>
  )
}
