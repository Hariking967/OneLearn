'use client'

import { useState } from 'react'
import { GraduationCap, Loader2, Plus, X } from 'lucide-react'
import type { Classroom } from '@/lib/supabase/types'

interface Props {
  onCreated: (classroom: Classroom) => void
}

export function CreateClassroomDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Failed to create classroom'); return }
      onCreated(body)
      setOpen(false)
      setName('')
      setDescription('')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
    setOpen(false)
    setName('')
    setDescription('')
    setError(null)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 16px', borderRadius: 10,
          background: 'hsl(38 92% 50% / 0.12)',
          border: '1px solid hsl(38 92% 50% / 0.28)',
          color: 'hsl(38 92% 65%)',
          fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
          cursor: 'pointer', transition: 'all 0.18s',
        }}
      >
        <Plus size={14} />
        New classroom
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          }}
          onClick={e => e.target === e.currentTarget && handleClose()}
        >
          <div
            style={{
              width: '100%', maxWidth: 440,
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: 18,
              boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '24px 28px 20px',
              borderBottom: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'hsl(38 92% 50% / 0.12)',
                  border: '1px solid hsl(38 92% 50% / 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <GraduationCap size={16} color="hsl(38 92% 65%)" />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                    Create classroom
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    Set up a space for your students
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Classroom name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  Classroom name <span style={{ color: 'var(--purple-2)' }}>*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleCreate()}
                  placeholder="e.g. Advanced Physics 2024"
                  autoFocus
                  className="neon-input"
                  style={{ width: '100%', height: 44, paddingLeft: 14, paddingRight: 14, borderRadius: 10, fontSize: 13 }}
                />
              </div>

              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  Description
                  <span style={{ marginLeft: 6, textTransform: 'none', letterSpacing: 0, color: 'var(--mute)', fontSize: 10 }}>
                    optional
                  </span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What will students learn in this classroom?"
                  rows={3}
                  className="neon-input"
                  style={{
                    width: '100%', paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12,
                    borderRadius: 10, fontSize: 13, resize: 'none', lineHeight: 1.55,
                  }}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 9, fontSize: 12,
                  background: 'hsl(0 72% 51% / 0.08)',
                  border: '1px solid hsl(0 72% 51% / 0.22)',
                  color: 'hsl(0 85% 72%)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {error}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button
                  onClick={handleClose}
                  disabled={loading}
                  style={{
                    flex: 1, height: 42, borderRadius: 10,
                    background: 'none', border: '1px solid var(--line)',
                    color: 'var(--mute)', fontSize: 13, fontFamily: 'var(--font-sans)',
                    cursor: 'pointer', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line-2, rgba(255,255,255,0.15))' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading || !name.trim()}
                  style={{
                    flex: 2, height: 42, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: 'hsl(38 92% 50% / 0.14)',
                    border: '1px solid hsl(38 92% 50% / 0.3)',
                    color: 'hsl(38 92% 65%)',
                    fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
                    cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
                    opacity: !name.trim() ? 0.5 : 1,
                    transition: 'all 0.18s',
                  }}
                >
                  {loading
                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creating…</>
                    : <><GraduationCap size={14} /> Create classroom</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
