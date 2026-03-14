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
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-cream">
      <div className="w-full max-w-md">
        {/* Logo — SVG, centered, big */}
        <div className="text-center mb-10">
          <img
            src="/logo.svg"
            alt="Caashflow"
            className="h-16 w-auto mx-auto"
          />
        </div>

        {inviteToken && mode !== 'forgot' && (
          <div className="bg-primary/10 rounded-lg px-5 py-4 mb-6 text-center">
            <div className="text-2xl mb-1">🏠</div>
            <p className="text-caption font-bold text-text-heading">You have a household invite!</p>
            <p className="text-caption text-text-muted mt-1">
              {mode === 'signup'
                ? 'Create an account below to accept it.'
                : 'Log in to join the household.'}
            </p>
          </div>
        )}

        {/* Card — shadow, no border */}
        <div className="bg-bg-white rounded-lg shadow-card p-8">
          {mode === 'forgot' ? (
            <>
              <div className="text-center mb-6">
                <div className="text-3xl mb-2">🔑</div>
                <h2 className="text-h3 font-bold text-text-heading">Reset Password</h2>
                <p className="text-caption text-text-muted mt-1">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-caption font-semibold text-text-heading block mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                {message && (
                  <div
                    className={`p-3 rounded-sm text-caption font-medium ${
                      message.type === 'error'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-success/10 text-success'
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-label font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <button
                onClick={() => { setMode('login'); setMessage(null) }}
                className="w-full text-center text-caption text-primary font-semibold mt-4 hover:underline transition-opacity"
              >
                Back to Login
              </button>
            </>
          ) : (
            <>
              {/* Login / Sign Up toggle — pill style */}
              <div className="flex bg-surface-beige rounded-full p-1 mb-8">
                <button
                  onClick={() => setMode('login')}
                  className={`flex-1 py-2.5 rounded-full text-caption font-bold transition-all ${
                    mode === 'login'
                      ? 'bg-bg-white text-text-heading shadow-sm'
                      : 'text-text-muted hover:text-text-heading'
                  }`}
                >
                  Log In
                </button>
                <button
                  onClick={() => setMode('signup')}
                  className={`flex-1 py-2.5 rounded-full text-caption font-bold transition-all ${
                    mode === 'signup'
                      ? 'bg-bg-white text-text-heading shadow-sm'
                      : 'text-text-muted hover:text-text-heading'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-caption font-semibold text-text-heading block mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="text-caption font-semibold text-text-heading block mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors"
                    placeholder={mode === 'signup' ? 'Create a password (6+ chars)' : 'Your password'}
                    minLength={6}
                  />
                </div>

                {mode === 'login' && (
                  <div className="text-right -mt-2">
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setMessage(null) }}
                      className="text-caption text-text-muted hover:text-primary font-semibold transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {message && (
                  <div
                    className={`p-3 rounded-sm text-caption font-medium ${
                      message.type === 'error'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-success/10 text-success'
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-label font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
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
        <div className="min-h-screen flex items-center justify-center bg-bg-cream">
          <div className="text-caption text-text-muted">Loading...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
