import { notFound } from 'next/navigation'
import { getPublicHousehold } from '@/app/actions/requests'
import PublicRequestForm from '@/components/requests/PublicRequestForm'

export default async function PublicRequestPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const household = await getPublicHousehold(slug)
  if (!household) notFound()

  return (
    <div className="min-h-screen bg-bg-cream flex items-start justify-center p-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo.svg" alt="Caashflow" className="h-12 w-auto mx-auto mb-4" />
          <h1 className="text-h2 font-bold text-text-heading">Add to {household.name}&apos;s list</h1>
          <p className="text-caption text-text-muted mt-1">Submit a request — no account needed.</p>
        </div>
        <PublicRequestForm slug={slug} />
      </div>
    </div>
  )
}
