'use client'

import { useState, useTransition } from 'react'
import { generateInviteLink, removeHouseholdMember } from '@/app/actions/household'
import type { HouseholdMember } from '@/lib/types'

interface MembersPanelProps {
  members: HouseholdMember[]
  currentUserId: string
}

export default function MembersPanel({ members, currentUserId }: MembersPanelProps) {
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [generatingLink, startGenerating] = useTransition()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [, startRemoving] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleGenerateLink = () => {
    setError(null)
    startGenerating(async () => {
      try {
        const token = await generateInviteLink()
        const link = `${window.location.origin}/join/${token}`
        setInviteLink(link)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to generate invite link')
      }
    })
  }

  const handleCopy = async () => {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRemove = (memberId: string) => {
    if (!confirm('Remove this member from the household?')) return
    setError(null)
    setRemovingId(memberId)
    startRemoving(async () => {
      try {
        await removeHouseholdMember(memberId)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove member')
      } finally {
        setRemovingId(null)
      }
    })
  }

  return (
    <div className="bg-white border border-line rounded-[20px] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-black font-display text-ink">Household Members</h2>
          <p className="text-xs text-muted mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={handleGenerateLink}
          disabled={generatingLink}
          className="bg-blue text-white rounded-[12px] px-4 py-2 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {generatingLink ? 'Generating...' : '+ Invite Member'}
        </button>
      </div>

      {/* Invite link banner */}
      {inviteLink && (
        <div className="bg-blue/5 border border-blue/20 rounded-[16px] p-4 mb-5">
          <p className="text-xs font-bold text-blue mb-2">🔗 Invite Link (expires in 7 days)</p>
          <p className="text-xs text-muted mb-3">
            Share this link with the person you want to invite. They&apos;ll create an account
            and be automatically added to your household.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 bg-white border border-line rounded-[10px] px-3 py-2 text-xs text-ink font-mono min-w-0"
            />
            <button
              onClick={handleCopy}
              className="bg-blue text-white rounded-[10px] px-3 py-2 text-xs font-bold whitespace-nowrap hover:opacity-90 transition-opacity"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-muted mt-2">
            Generating a new link expires the previous one.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-orange/10 border border-orange/20 rounded-[12px] px-4 py-3 mb-4 text-sm text-orange font-medium">
          {error}
        </div>
      )}

      {/* Members list */}
      <div className="space-y-3">
        {members.map((member) => {
          const isCurrentUser = member.user_id === currentUserId
          const isOwner = member.role === 'owner'

          return (
            <div
              key={member.id}
              className="flex items-center justify-between py-3 border-b border-line last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar placeholder */}
                <div className="w-9 h-9 rounded-full bg-cream-2 border border-line flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-muted">
                    {(member.email ?? member.user_id).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-ink truncate">
                      {member.email ?? `Member ${member.id.slice(0, 8)}`}
                    </span>
                    {isCurrentUser && (
                      <span className="text-xs text-muted font-medium">(you)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                        isOwner
                          ? 'bg-blue/10 text-blue'
                          : 'bg-green/10 text-green'
                      }`}
                    >
                      {isOwner ? 'Owner' : 'Member'}
                    </span>
                    {member.created_at && (
                      <span className="text-xs text-muted">
                        Joined {new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Remove button — only owner can remove, and only non-owners */}
              {!isCurrentUser && !isOwner && (
                <button
                  onClick={() => handleRemove(member.id)}
                  disabled={removingId === member.id}
                  className="text-xs text-muted hover:text-orange font-bold transition-colors ml-4 flex-shrink-0 disabled:opacity-50"
                >
                  {removingId === member.id ? 'Removing...' : 'Remove'}
                </button>
              )}
            </div>
          )
        })}

        {members.length === 0 && (
          <div className="text-center py-8 text-muted text-sm">
            No members yet. Invite someone to get started.
          </div>
        )}
      </div>
    </div>
  )
}
