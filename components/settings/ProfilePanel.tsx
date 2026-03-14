'use client'

import { useState, useTransition, useRef } from 'react'
import { updateProfile, uploadAvatar, removeAvatar } from '@/app/actions/profile'
import { renameHousehold, leaveHousehold } from '@/app/actions/household'
import type { UserProfile } from '@/lib/types'
import { Pencil, LogOut as LogOutIcon, Check, X } from 'lucide-react'

interface HouseholdInfo {
  household_id: string
  role: 'owner' | 'member'
  name: string
}

interface ProfilePanelProps {
  profile: UserProfile | null
  email: string
  households: HouseholdInfo[]
}

export default function ProfilePanel({ profile, email, households: initialHouseholds }: ProfilePanelProps) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)
  const [households, setHouseholds] = useState(initialHouseholds)
  const [saving, startSaving] = useTransition()
  const [uploading, startUploading] = useTransition()
  const [removing, startRemoving] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Household editing state
  const [editingHouseholdId, setEditingHouseholdId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [householdAction, startHouseholdAction] = useTransition()

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

  const handleStartRename = (h: HouseholdInfo) => {
    setEditingHouseholdId(h.household_id)
    setEditingName(h.name)
  }

  const handleCancelRename = () => {
    setEditingHouseholdId(null)
    setEditingName('')
  }

  const handleSaveRename = (householdId: string) => {
    startHouseholdAction(async () => {
      try {
        await renameHousehold(householdId, editingName)
        setHouseholds(prev =>
          prev.map(h =>
            h.household_id === householdId ? { ...h, name: editingName.trim() } : h
          )
        )
        setEditingHouseholdId(null)
        showMessage('success', 'Household renamed')
      } catch (e) {
        showMessage('error', e instanceof Error ? e.message : 'Failed to rename')
      }
    })
  }

  const handleLeave = (householdId: string, name: string) => {
    if (!confirm(`Leave "${name}"? You'll need a new invite to rejoin.`)) return

    startHouseholdAction(async () => {
      try {
        await leaveHousehold(householdId)
        setHouseholds(prev => prev.filter(h => h.household_id !== householdId))
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
    <div className="bg-bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-h3 font-bold text-text-heading mb-6">Profile</h2>

      {/* Avatar section */}
      <div className="flex items-center gap-5 mb-6">
        <div className="relative group">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-surface-beige border-2 border-border flex items-center justify-center flex-shrink-0">
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
            className="w-full border border-border rounded-lg px-3 py-2.5 text-body text-text-heading placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-teal/30 focus:border-primary-teal transition-colors"
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
            className="w-full border border-border rounded-lg px-3 py-2.5 text-body text-text-muted bg-surface-beige/30 cursor-not-allowed"
          />
          <p className="text-caption text-text-muted mt-1">Email is managed through your login provider</p>
        </div>

        {/* Households */}
        <div>
          <label className="text-caption font-semibold text-text-heading block mb-2">
            Households
          </label>
          <div className="space-y-2">
            {households.map((h) => {
              const isEditing = editingHouseholdId === h.household_id
              const isOwner = h.role === 'owner'

              return (
                <div
                  key={h.household_id}
                  className="flex items-center gap-2 border border-border rounded-lg px-3 py-2.5"
                >
                  {isEditing ? (
                    /* Rename inline edit */
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(h.household_id)
                          if (e.key === 'Escape') handleCancelRename()
                        }}
                        autoFocus
                        className="flex-1 border-0 bg-transparent text-body text-text-heading focus:outline-none min-w-0"
                      />
                      <button
                        onClick={() => handleSaveRename(h.household_id)}
                        disabled={householdAction}
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
                          aria-label="Rename household"
                          title="Rename"
                        >
                          <Pencil size={14} />
                        </button>
                      )}

                      {/* Non-owner can leave */}
                      {!isOwner && (
                        <button
                          onClick={() => handleLeave(h.household_id, h.name)}
                          disabled={householdAction}
                          className="text-text-muted hover:text-warning transition-colors p-0.5 flex-shrink-0 disabled:opacity-50"
                          aria-label="Leave household"
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

            {households.length === 0 && (
              <p className="text-caption text-text-muted py-2">No households. Join one via invite link.</p>
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
