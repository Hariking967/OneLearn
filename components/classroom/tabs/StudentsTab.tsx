'use client'
import { useState } from 'react'
import { Users, Trash2, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

interface Member {
  id: string
  student_id: string
  joined_at: string
  email: string
  user_profiles?: { display_name: string | null; role: string }
}

interface Props {
  classroomId: string
  isTeacher: boolean
  initialMembers: Member[]
  onReload: () => void
}

export function StudentsTab({ classroomId, isTeacher, initialMembers, onReload }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [analysingId, setAnalysingId] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function removeStudent(studentId: string) {
    setRemovingId(studentId)
    try {
      await fetch(`/api/classrooms/${classroomId}/members?studentId=${studentId}`, { method: 'DELETE' })
      setMembers(m => m.filter(x => x.student_id !== studentId))
    } finally {
      setRemovingId(null)
    }
  }

  async function analyseStudent(studentId: string) {
    if (expandedId === studentId && analyses[studentId]) {
      setExpandedId(null)
      return
    }
    setExpandedId(studentId)
    if (analyses[studentId]) return
    setAnalysingId(studentId)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/students/analyse?studentId=${studentId}`)
      if (res.ok) {
        const { analysis } = await res.json()
        setAnalyses(a => ({ ...a, [studentId]: analysis }))
      }
    } finally {
      setAnalysingId(null)
    }
  }

  if (members.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '80px 0', gap: 10, maxWidth: 560,
        border: '1px dashed var(--line)', borderRadius: 14,
        color: 'var(--mute)', fontSize: 13, fontFamily: 'var(--font-mono)',
      }}>
        <Users size={28} style={{ opacity: 0.3 }} />
        No students yet.{isTeacher && ' Use "Add student" to invite by email.'}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560 }}>
      {members.map((m, i) => {
        const displayName = m.user_profiles?.display_name || m.email || `Student ${m.student_id.slice(0, 8)}`
        const initials = displayName[0].toUpperCase()
        const analysis = analyses[m.student_id]
        const isExpanded = expandedId === m.student_id
        const isAnalysing = analysingId === m.student_id

        return (
          <div
            key={m.id}
            style={{
              borderRadius: 12, overflow: 'hidden',
              background: 'linear-gradient(180deg, rgba(21,21,29,0.75), rgba(15,15,21,0.75))',
              border: '1px solid var(--line)',
              animationDelay: `${i * 40}ms`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'oklch(0.42 0.18 295 / 0.15)', color: 'var(--purple-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 600,
              }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 2px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </p>
                <p style={{ fontSize: 11, color: 'var(--mute)', margin: 0, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </p>
              </div>
              <span style={{ fontSize: 11, color: 'var(--mute)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                {new Date(m.joined_at).toLocaleDateString()}
              </span>

              {/* Analyse button — teacher only */}
              {isTeacher && (
                <button
                  onClick={() => analyseStudent(m.student_id)}
                  disabled={isAnalysing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                    background: isExpanded ? 'oklch(0.42 0.18 295 / 0.15)' : 'var(--bg-3)',
                    border: `1px solid ${isExpanded ? 'oklch(0.42 0.18 295 / 0.3)' : 'var(--line)'}`,
                    color: isExpanded ? 'var(--purple-2)' : 'var(--mute)',
                    fontSize: 11, fontFamily: 'var(--font-sans)',
                  }}
                >
                  {isAnalysing
                    ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Sparkles size={11} />
                  }
                  Analyse
                  {!isAnalysing && (isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                </button>
              )}

              {/* Remove button — teacher only */}
              {isTeacher && (
                <button
                  onClick={() => removeStudent(m.student_id)}
                  disabled={removingId === m.student_id}
                  style={{ padding: 6, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', flexShrink: 0, transition: 'color 0.15s' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'hsl(0 85% 70%)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)')}
                  title="Remove student"
                >
                  {removingId === m.student_id
                    ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Trash2 size={13} />
                  }
                </button>
              )}
            </div>

            {/* Analysis panel */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px' }}>
                {isAnalysing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--mute)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    Analysing performance…
                  </div>
                ) : analysis ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Sparkles size={11} color="var(--purple-2)" />
                      <span style={{ fontSize: 10, color: 'var(--purple-2)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        AI Analysis
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
                      {analysis}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
