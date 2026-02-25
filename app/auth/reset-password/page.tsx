'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
    } else {
      setMessage({ type: 'success', text: 'Password updated! Redirecting...' })
      setTimeout(() => {
        window.location.href = '/'
      }, 1500)
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

        <div className="bg-white rounded-[28px] border border-line p-8">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🔒</div>
            <h2 className="text-xl font-black font-display text-ink">Set New Password</h2>
            <p className="text-xs text-muted mt-1">
              Choose a new password for your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-ink mb-1.5">New Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-line rounded-[12px] text-ink focus:outline-none focus:border-blue transition-colors"
                placeholder="New password (6+ chars)"
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink mb-1.5">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-line rounded-[12px] text-ink focus:outline-none focus:border-blue transition-colors"
                placeholder="Confirm new password"
                minLength={6}
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
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
