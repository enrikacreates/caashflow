import { getBudgetRequests } from '@/app/actions/requests'
import { getPriorityCategories } from '@/app/actions/settings'
import RequestsClient from '@/components/requests/RequestsClient'

export default async function RequestsPage() {
  const [requests, categories] = await Promise.all([
    getBudgetRequests(),
    getPriorityCategories(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black font-display text-ink">Budget Requests</h1>
        <p className="text-muted text-sm mt-1">One-time purchases and upcoming items</p>
      </div>
      <RequestsClient requests={requests} categories={categories ?? []} />
    </div>
  )
}
