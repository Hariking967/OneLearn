'use client'

import Link from 'next/link'
import { Users, BookOpen, ArrowRight, Trash2 } from 'lucide-react'
import type { Classroom } from '@/lib/supabase/types'

interface Props {
  classroom: Classroom & { classroom_members?: [{ count: number }]; classroom_projects?: [{ count: number }] }
  isTeacher: boolean
  onDelete?: (id: string) => void
  animDelay?: number
}

export function ClassroomCard({ classroom, isTeacher, onDelete, animDelay = 0 }: Props) {
  const memberCount = (classroom as any).classroom_members?.[0]?.count ?? 0
  const projectCount = (classroom as any).classroom_projects?.[0]?.count ?? 0
  const hue = isTeacher ? 38 : 271

  return (
    <div
      className="project-card animate-fade-up"
      style={{ animationDelay: `${animDelay}ms`, cursor: 'default' }}
    >
      {/* Delete */}
      {isTeacher && onDelete && (
        <button
          onClick={() => onDelete(classroom.id)}
          className="card-delete-btn"
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 2,
            opacity: 0, transition: 'opacity 0.18s',
            padding: 5, borderRadius: 7,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--mute)',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'hsl(0 85% 70%)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)'}
        >
          <Trash2 size={13} />
        </button>
      )}

      {/* Thumb strip */}
      <div style={{
        height: 6, borderTopLeftRadius: 14, borderTopRightRadius: 14,
        background: isTeacher
          ? 'linear-gradient(90deg, oklch(0.68 0.18 38), oklch(0.55 0.18 38 / 0.5))'
          : 'linear-gradient(90deg, oklch(0.68 0.19 295), oklch(0.55 0.18 295 / 0.5))',
      }} />

      {/* Body */}
      <div style={{ padding: '16px 18px 18px' }}>
        {/* Chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <span className={`chip${isTeacher ? ' chip-active' : ''}`}
            style={!isTeacher ? { color: 'oklch(0.78 0.13 295)', borderColor: 'oklch(0.42 0.18 295 / 0.5)', background: 'oklch(0.42 0.18 295 / 0.1)' } : undefined}>
            {isTeacher ? 'Owner' : 'Member'}
          </span>
          {classroom.invite_code && (
            <span className="chip" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
              #{classroom.invite_code}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.01em', margin: '0 0 6px', color: 'var(--ink)', paddingRight: 20 }}>
          {classroom.name}
        </h3>

        {classroom.description && (
          <p style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.55, margin: '0 0 14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {classroom.description}
          </p>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', margin: '12px 0 16px' }}>
          {isTeacher && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Users size={11} /> {memberCount} student{memberCount !== 1 ? 's' : ''}
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <BookOpen size={11} /> {projectCount} project{projectCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <Link href={`/classroom/${classroom.id}`} style={{ textDecoration: 'none' }}>
            <button style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '8px 0', borderRadius: 9,
              background: `hsl(${hue} 50% 40% / 0.1)`,
              border: `1px solid hsl(${hue} 50% 60% / 0.2)`,
              color: `hsl(${hue} 70% 68%)`,
              fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
              cursor: 'pointer', transition: 'all 0.18s',
            }}>
              Open classroom
              <ArrowRight size={12} />
            </button>
          </Link>
        </div>
      </div>

      {/* Shimmer orb */}
      <div className="shimmer-orb" style={{ background: `radial-gradient(circle, hsl(${hue} 70% 60% / 0.2), transparent 65%)` }} />
    </div>
  )
}
