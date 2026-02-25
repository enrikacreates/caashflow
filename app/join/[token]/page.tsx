import { getInviteDetails } from '@/app/actions/household'
import Link from 'next/link'

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await getInviteDetails(token)

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-cream">
        <div className="w-full max-w-md text-center">
          <h1 className="text-5xl font-black font-display tracking-tight text-ink mb-4">
            CAASHFLOW
          </h1>
          <div className="bg-white rounded-[28px] border border-line p-8">
            <div className="text-4xl mb-4">🔗</div>
            <h2 className="text-xl font-black font-display text-ink mb-2">
              Invalid Invite
            </h2>
            <p className="text-muted text-sm mb-6">
              This invite link is invalid, already used, or has expired. Ask the household owner to generate a new one.
            </p>
            <Link
              href="/login"
              className="inline-block bg-blue text-white rounded-[12px] px-6 py-3 font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-cream">
      <div className="w-full max-w-md text-center">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black font-display tracking-tight text-ink">
            CAASHFLOW
          </h1>
          <p className="text-muted mt-2 text-sm font-semibold uppercase tracking-widest">
            Budget System
          </p>
        </div>

        <div className="bg-white rounded-[28px] border border-line p-8">
          <div className="text-4xl mb-4">🏠</div>
          <h2 className="text-2xl font-black font-display text-ink mb-2">
            You&apos;re Invited!
          </h2>
          <p className="text-muted text-sm mb-2">
            You&apos;ve been invited to join
          </p>
          <p className="text-lg font-black text-ink mb-6">
            {invite.householdName}
          </p>
          <p className="text-xs text-muted mb-8">
            Create an account to accept this invite and start managing your household budget together.
          </p>

          <Link
            href={`/login?invite=${invite.token}&mode=signup`}
            className="block w-full py-3 bg-blue text-white rounded-[12px] font-bold text-sm hover:opacity-90 transition-opacity text-center"
          >
            Accept Invite &amp; Create Account
          </Link>

          <p className="text-xs text-muted mt-4">
            Already have an account?{' '}
            <Link href={`/login?invite=${invite.token}`} className="text-blue font-bold">
              Log in instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
