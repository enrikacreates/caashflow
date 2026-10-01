'use client'

import { useState, useTransition, useRef } from 'react'
import { updateProfile, uploadAvatar, removeAvatar } from '@/app/actions/profile'
import { renameTeam, leaveTeam } from '@/app/actions/team'
import type { UserProfile } from '@/lib/types'
import { Pencil, LogOut as LogOutIcon, Check, X } from 'lucide-react'

interface TeamInfo {
  team_id: string
  role: 'owner' | 'member'
  name: string
}

interface ProfilePanelProps {
  profile: UserProfile | null
  email: string
  teams: TeamInfo[]
}

export default function ProfilePanel({ profile, email, teams: initialTeams }: ProfilePanelProps) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)
  const [teams, setTeams] = useState(initialTeams)
  const [saving, startSaving] = useTransition()
  const [uploading, startUploading] = useTransition()
  const [removing, startRemoving] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [teamAction, startTeamAction] = useTransition()

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleSave = () => {
    startSaving(async () => {
      try {
        const fd = new FormData()
        fd.set('display_name', displayName)
        await updateProfile(fd)
        showMessage('success', 'Profile updated')
      } catch (e) {
        showMessage('error', e instanceof Error ? e.message : 'Failed to save')
      }
    })
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    startUploading(async () => {
      try {
        const fd = new FormData()
        fd.set('avatar', file)
        const newUrl = await uploadAvatar(fd)
        setAvatarUrl(newUrl)
        showMessage('success', 'Photo updated')
      } catch (e) {
        showMessage('error', e instanceof Error ? e.message : 'Upload failed')
      }
    })
  }

  const handleRemoveAvatar = () => {
    startRemoving(async () => {
      try {
        await removeAvatar()
        setAvatarUrl(null)
        showMessage('success', 'Photo removed')
      } catch (e) {
        showMessage('error', e instanceof Error ? e.message : 'Failed to remove')
      }
    })
  }

  const handleStartRename = (h: TeamInfo) => {
    setEditingTeamId(h.team_id)
    setEditingName(h.name)
  }

  const handleCancelRename = () => {
    setEditingTeamId(null)
    setEditingName('')
  }

  const handleSaveRename = (teamId: string) => {
    startTeamAction(async () => {
      try {
        await renameTeam(teamId, editingName)
        setTeams(prev =>
          prev.map(h =>
            h.team_id === teamId ? { ...h, name: editingName.trim() } : h
          )
        )
        setEditingTeamId(null)
        showMessage('success', 'Team renamed')
      } catch (e) {
        showMessage('error', e instanceof Error ? e.message : 'Failed to rename')
      }
    })
  }

  const handleLeave = (teamId: string, name: string) => {
    if (!confirm(`Leave "${name}"? You'll need a new invite to rejoin.`)) return

    startTeamAction(async () => {
      try {
        await leaveTeam(teamId)
        setTeams(prev => prev.filter(h => h.team_id !== teamId))
        showMessage('success', `Left "${name}"`)
      } catch (e) {
        showMessage('error', e instanceof Error ? e.message : 'Failed to leave')
      }
    })
  }

  // Get initials for avatar placeholder
  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : email.charAt(0).toUpperCase()

  return (
    <div className="bg-bg-white rounded-lg shadow-card p-6">
      <h2 className="text-h3 font-bold text-text-heading mb-6">Profile</h2>

      {/* Avatar section */}
      <div className="flex items-center gap-5 mb-6">
        <div className="relative group">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-surface-beige shadow-sm flex items-center justify-center flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile photo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-text-muted">{initials}</span>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <span className="text-white text-caption font-semibold">
              {uploading ? '...' : 'Edit'}
            </span>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-caption font-semibold text-primary-teal hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload photo'}
            </button>
            {avatarUrl && (
              <button
                onClick={handleRemoveAvatar}
                disabled={removing}
                className="text-caption font-semibold text-text-muted hover:text-warning transition-colors disabled:opacity-50"
              >
                {removing ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>
          <p className="text-caption text-text-muted">JPG, PNG, WebP, or GIF. Max 2MB.</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleAvatarChange}
          className="hidden"
        />
      </div>

      {/* Profile fields */}
      <div className="space-y-4">
        {/* Display name */}
        <div>
          <label className="text-caption font-semibold text-text-heading block mb-1">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-bg-white border border-border rounded-sm px-4 py-2.5 text-caption focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="text-caption font-semibold text-text-heading block mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            readOnly
            className="w-full bg-surface-beige/30 border border-border rounded-sm px-4 py-2.5 text-caption text-text-muted cursor-not-allowed"
          />
          <p className="text-caption text-text-muted mt-1">Email is managed through your login provider</p>
        </div>

        {/* Teams */}
        <div>
          <label className="text-caption font-semibold text-text-heading block mb-2">
            Household
          </label>
          <div className="space-y-2">
            {teams.map((h) => {
              const isEditing = editingTeamId === h.team_id
              const isOwner = h.role === 'owner'

              return (
                <div
                  key={h.team_id}
                  className="flex items-center gap-2 bg-surface-beige/30 rounded-sm px-4 py-2.5"
                >
                  {isEditing ? (
                    /* Rename inline edit */
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(h.team_id)
                          if (e.key === 'Escape') handleCancelRename()
                        }}
                        autoFocus
                        className="flex-1 border-0 bg-transparent text-body text-text-heading focus:outline-none min-w-0"
                      />
                      <button
                        onClick={() => handleSaveRename(h.team_id)}
                        disabled={teamAction}
                        className="text-primary-teal hover:opacity-80 transition-opacity p-0.5"
                        aria-label="Save name"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="text-text-muted hover:text-text transition-colors p-0.5"
                        aria-label="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    /* Normal display */
                    <>
                      <span className="text-body text-text-heading flex-1 truncate">
                        {h.name}
                      </span>

                      {/* Role badge */}
                      <span
                        className={`text-caption font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          isOwner
                            ? 'bg-primary-teal/10 text-primary'
                            : 'bg-green/10 text-green'
                        }`}
                      >
                        {isOwner ? 'Owner' : 'Member'}
                      </span>

                      {/* Owner can rename */}
                      {isOwner && (
                        <button
                          onClick={() => handleStartRename(h)}
                          className="text-text-muted hover:text-text-heading transition-colors p-0.5 flex-shrink-0"
                          aria-label="Rename team"
                          title="Rename"
                        >
                          <Pencil size={14} />
                        </button>
                      )}

                      {/* Non-owner can leave */}
                      {!isOwner && (
                        <button
                          onClick={() => handleLeave(h.team_id, h.name)}
                          disabled={teamAction}
                          className="text-text-muted hover:text-warning transition-colors p-0.5 flex-shrink-0 disabled:opacity-50"
                          aria-label="Leave team"
                          title="Leave"
                        >
                          <LogOutIcon size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}

            {teams.length === 0 && (
              <p className="text-caption text-text-muted py-2">No teams yet. Join one via invite link.</p>
            )}
          </div>
        </div>
      </div>

      {/* Save + feedback */}
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary-teal text-text-inverse rounded-full px-5 py-2.5 text-caption font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>

        {message && (
          <span
            className={`text-caption font-medium ${
              message.type === 'success' ? 'text-green' : 'text-warning'
            }`}
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  )
}
