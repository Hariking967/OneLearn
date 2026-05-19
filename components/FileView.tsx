'use client'
import Link from 'next/link'
import { CheckCircle, Lock, Unlock, FileText } from 'lucide-react'
import type { Topic } from '@/lib/supabase/types'

interface Props {
  topics: Topic[]
  projectId: string
  resourceCount?: Record<string, number>
}

const statusConfig = {
  done: {
    label: 'Done',
    color: 'oklch(0.72 0.18 145)',
    bg: 'oklch(0.72 0.18 145 / 0.08)',
    border: 'oklch(0.72 0.18 145 / 0.25)',
    Icon: CheckCircle,
  },
  unlocked: {
    label: 'In Progress',
    color: 'oklch(0.55 0.18 250)',
    bg: 'oklch(0.55 0.18 250 / 0.08)',
    border: 'oklch(0.55 0.18 250 / 0.25)',
    Icon: Unlock,
  },
  locked: {
    label: 'Locked',
    color: 'var(--mute)',
    bg: 'rgba(255,255,255,0.02)',
    border: 'var(--line)',
    Icon: Lock,
  },
}

export function FileView({ topics, projectId, resourceCount = {} }: Props) {
  if (topics.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--mute)', fontSize: 13,
        fontFamily: 'var(--font-mono)', border: '1px dashed var(--line)',
        borderRadius: 14,
      }}>
        No topics yet.
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
      gap: 12,
      padding: 4,
      alignContent: 'start',
    }}>
      {topics.map(t => {
        const cfg = statusConfig[t.status] ?? statusConfig.locked
        const rc = resourceCount[t.id] ?? 0
        return (
          <Link key={t.id} href={`/project/${projectId}/topic/${t.id}`} style={{ textDecoration: 'none' }}>
            <div
              style={{
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                background: cfg.bg, border: `1px solid ${cfg.border}`,
                transition: 'transform 0.15s, box-shadow 0.15s',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px ${cfg.bg}`
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <cfg.Icon size={14} color={cfg.color} />
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', color: cfg.color,
                  padding: '2px 6px', borderRadius: 5,
                  background: `${cfg.border}`,
                  border: `1px solid ${cfg.border}`,
                }}>
                  {cfg.label}
                </span>
              </div>
              <p style={{
                fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink)',
                margin: '0 0 8px', letterSpacing: '-0.01em', lineHeight: 1.35,
                display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {t.name}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--mute)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                  <FileText size={10} />
                  {rc} resource{rc !== 1 ? 's' : ''}
                </div>
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', color: cfg.color,
                  padding: '2px 7px', borderRadius: 5,
                  background: cfg.bg, border: `1px solid ${cfg.border}`,
                  cursor: 'pointer',
                }}>
                  Open →
                </span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
