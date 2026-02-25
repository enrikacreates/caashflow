'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const supabase = createClient()

  // Sync mode if URL param changes
  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      })
      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({
          type: 'success',
          text: 'Password reset link sent! Check your email.',
        })
      }
      setLoading(false)
      return
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage({ type: 'error', text: error.message })
        setLoading(false)
      } else {
        // If they logged in with an invite, handle household join
        if (inviteToken) {
          await fetch(`/api/join-household?token=${inviteToken}`, { method: 'POST' }).catch(() => {})
        }
        window.location.href = '/'
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: inviteToken ? { invite_token: inviteToken } : undefined,
        },
      })
      if (error) {
        setMessage({ type: 'error', text: error.message })
        setLoading(false)
      } else {
        setMessage({
          type: 'success',
          text: inviteToken
            ? 'Account created! Check your email to confirm, then you\'ll be added to the household.'
            : 'Check your email to confirm your account!',
        })
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-cream">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black font-display tracking-tight text-ink">
            CAASHFLOW
          </h1>
          <p className="text-muted mt-2 text-sm font-semibold uppercase tracking-widest">
            Budget System
          </p>
        </div>

        {inviteToken && mode !== 'forgot' && (
          <div className="bg-blue/10 border border-blue/20 rounded-[16px] px-5 py-4 mb-6 text-center">
            <div className="text-2xl mb-1">🏠</div>
            <p className="text-sm font-bold text-ink">You have a household invite!</p>
            <p className="text-xs text-muted mt-1">
              {mode === 'signup'
                ? 'Create an account below to accept it.'
                : 'Log in to join the household.'}
            </p>
          </div>
        )}

        <div className="bg-white rounded-[28px] border border-line p-8">
          {mode === 'forgot' ? (
            <>
              <div className="text-center mb-6">
                <div className="text-3xl mb-2">🔑</div>
                <h2 className="text-xl font-black font-display text-ink">Reset Password</h2>
                <p className="text-xs text-muted mt-1">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-ink mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-line rounded-[12px] text-ink focus:outline-none focus:border-blue transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                {message && (
                  <div
                    className={`p-3 rounded-[12px] text-sm font-medium ${
                      message.type === 'error'
                        ? 'bg-orange/10 text-orange border border-orange/20'
                        : 'bg-green/10 text-green border border-green/20'
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue text-white rounded-[12px] font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <button
                onClick={() => { setMode('login'); setMessage(null) }}
                className="w-full text-center text-sm text-blue font-bold mt-4 hover:opacity-70 transition-opacity"
              >
                Back to Login
              </button>
            </>
          ) : (
            <>
              <div className="flex bg-cream-2 rounded-[12px] p-1 mb-8">
                <button
                  onClick={() => setMode('login')}
                  className={`flex-1 py-2.5 rounded-[10px] text-sm font-bold transition-all ${
                    mode === 'login'
                      ? 'bg-white text-ink shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Log In
                </button>
                <button
                  onClick={() => setMode('signup')}
                  className={`flex-1 py-2.5 rounded-[10px] text-sm font-bold transition-all ${
                    mode === 'signup'
                      ? 'bg-white text-ink shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-ink mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-line rounded-[12px] text-ink focus:outline-none focus:border-blue transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-line rounded-[12px] text-ink focus:outline-none focus:border-blue transition-colors"
                    placeholder={mode === 'signup' ? 'Create a password (6+ chars)' : 'Your password'}
                    minLength={6}
                  />
                </div>

                {mode === 'login' && (
                  <div className="text-right -mt-2">
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setMessage(null) }}
                      className="text-xs text-muted hover:text-blue font-semibold transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {message && (
                  <div
                    className={`p-3 rounded-[12px] text-sm font-medium ${
                      message.type === 'error'
                        ? 'bg-orange/10 text-orange border border-orange/20'
                        : 'bg-green/10 text-green border border-green/20'
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue text-white rounded-[12px] font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Loading...' : mode === 'login' ? 'Log In' : 'Create Account'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-cream">
          <div className="text-muted text-sm">Loading...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
