'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  ClipboardList, Clock, CheckCircle, Loader2, Eye, ChevronDown, ChevronUp,
  Sparkles, Plus, X, Edit3
} from 'lucide-react'
import type { ClassroomAssignment, AssignmentSubmission } from '@/lib/supabase/types'

interface Props {
  classroomId: string
  isTeacher: boolean
  initialAssignments: ClassroomAssignment[]
  mySubmissions: AssignmentSubmission[]
  onCreated: (a: ClassroomAssignment) => void
}

interface MCQQuestion { question: string; options: string[]; answer: string; explanation: string }
interface DescQuestion { question: string; model_answer: string; marks: number }
type AnyQuestion = MCQQuestion | DescQuestion

export function AssignmentsTab({ classroomId, isTeacher, initialAssignments, mySubmissions, onCreated }: Props) {
  const [assignments, setAssignments] = useState(initialAssignments)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [submissionsData, setSubmissionsData] = useState<Record<string, any>>({})
  const [submissionsLoading, setSubmissionsLoading] = useState<string | null>(null)

  // Generate dialog state
  const [showGenerate, setShowGenerate] = useState(false)
  const [genPrompt, setGenPrompt] = useState('')
  const [genType, setGenType] = useState<'mcq' | 'descriptive'>('mcq')
  const [genCount, setGenCount] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  // Preview/edit state
  const [previewQuestions, setPreviewQuestions] = useState<AnyQuestion[] | null>(null)
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [assignmentDeadline, setAssignmentDeadline] = useState('')
  const [posting, setPosting] = useState(false)

  const submissionMap: Record<string, AssignmentSubmission> = {}
  for (const s of mySubmissions) submissionMap[s.assignment_id] = s

  async function toggleSubmissions(assignmentId: string) {
    if (expandedId === assignmentId) { setExpandedId(null); return }
    setExpandedId(assignmentId)
    if (submissionsData[assignmentId]) return
    setSubmissionsLoading(assignmentId)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/assignments/${assignmentId}/submissions`)
      if (res.ok) { const data = await res.json(); setSubmissionsData(d => ({ ...d, [assignmentId]: data })) }
    } finally { setSubmissionsLoading(null) }
  }

  async function generateQuestions() {
    if (!genPrompt.trim()) return
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/assignments/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: genPrompt, type: genType, count: genCount }),
      })
      if (res.ok) {
        const { questions } = await res.json()
        setPreviewQuestions(questions)
      } else {
        const { error } = await res.json()
        setGenError(error ?? 'Failed to generate questions')
      }
    } catch {
      setGenError('Network error')
    } finally { setGenerating(false) }
  }

  async function postAssignment() {
    if (!previewQuestions || !assignmentTitle.trim()) return
    setPosting(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: assignmentTitle.trim(),
          type: genType,
          questions: previewQuestions,
          deadline: assignmentDeadline || null,
        }),
      })
      if (res.ok) {
        const a: ClassroomAssignment = await res.json()
        setAssignments(p => [a, ...p])
        onCreated(a)
        // Auto-announce
        await fetch(`/api/classrooms/${classroomId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'announcement',
            title: `New assignment: ${assignmentTitle.trim()}`,
            text: `A new ${genType.toUpperCase()} assignment has been posted${assignmentDeadline ? ` — due ${new Date(assignmentDeadline).toLocaleDateString()}` : ''}.`,
          }),
        })
        setShowGenerate(false)
        setPreviewQuestions(null)
        setGenPrompt('')
        setAssignmentTitle('')
        setAssignmentDeadline('')
      }
    } finally { setPosting(false) }
  }

  function resetGenerate() {
    setShowGenerate(false)
    setPreviewQuestions(null)
    setGenPrompt('')
    setGenError(null)
    setAssignmentTitle('')
    setAssignmentDeadline('')
  }

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
    fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
    background: 'oklch(0.42 0.18 295 / 0.12)',
    border: '1px solid oklch(0.42 0.18 295 / 0.3)',
    color: 'var(--purple-2)',
  }

  return (
    <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Teacher: generate button */}
      {isTeacher && !showGenerate && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowGenerate(true)} style={btnBase}>
            <Sparkles size={13} /> AI Generate Assignment
          </button>
        </div>
      )}

      {/* Generate / Preview panel */}
      {isTeacher && showGenerate && (
        <div style={{
          borderRadius: 14, border: '1px solid oklch(0.42 0.18 295 / 0.3)',
          background: 'oklch(0.18 0.04 295 / 0.4)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 18px', borderBottom: '1px solid oklch(0.42 0.18 295 / 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={13} color="var(--purple-2)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                {previewQuestions ? 'Review & Post Assignment' : 'Generate Assignment'}
              </span>
            </div>
            <button onClick={resetGenerate} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: 4 }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!previewQuestions ? (
              // Step 1: configure generation
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Topic / prompt
                  </label>
                  <textarea
                    value={genPrompt}
                    onChange={e => setGenPrompt(e.target.value)}
                    placeholder="e.g. Newton's laws of motion, chapters 3–5"
                    rows={3}
                    style={{
                      background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8,
                      padding: '8px 12px', fontSize: 13, color: 'var(--ink)', resize: 'vertical',
                      fontFamily: 'var(--font-sans)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Type</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['mcq', 'descriptive'] as const).map(t => (
                        <button key={t} onClick={() => setGenType(t)} style={{
                          flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                          background: genType === t ? 'oklch(0.42 0.18 295 / 0.2)' : 'var(--bg-3)',
                          border: `1px solid ${genType === t ? 'oklch(0.42 0.18 295 / 0.4)' : 'var(--line)'}`,
                          color: genType === t ? 'var(--purple-2)' : 'var(--mute)',
                        }}>
                          {t === 'mcq' ? 'MCQ' : 'Descriptive'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Count</label>
                    <input
                      type="number" min={1} max={20} value={genCount}
                      onChange={e => setGenCount(Number(e.target.value))}
                      style={{ width: 70, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: 'var(--ink)', textAlign: 'center' }}
                    />
                  </div>
                </div>

                {genError && (
                  <p style={{ fontSize: 12, color: 'hsl(0 85% 70%)', fontFamily: 'var(--font-mono)', margin: 0 }}>{genError}</p>
                )}

                <button
                  onClick={generateQuestions}
                  disabled={generating || !genPrompt.trim()}
                  style={{ ...btnBase, justifyContent: 'center', padding: '9px 0' }}
                >
                  {generating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                  {generating ? 'Generating…' : 'Generate Questions'}
                </button>
              </>
            ) : (
              // Step 2: review + title + post
              <>
                {/* Questions preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {previewQuestions.map((q, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--line)' }}>
                      <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 6px', fontWeight: 500 }}>
                        {i + 1}. {q.question}
                      </p>
                      {'options' in q && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {(q as MCQQuestion).options.map((opt, j) => (
                            <span key={j} style={{
                              fontSize: 12, color: opt === (q as MCQQuestion).answer ? 'oklch(0.72 0.18 145)' : 'var(--mute)',
                              fontFamily: 'var(--font-mono)',
                            }}>
                              {opt} {opt === (q as MCQQuestion).answer ? '✓' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      {'model_answer' in q && (
                        <p style={{ fontSize: 11, color: 'var(--mute)', margin: '4px 0 0', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                          Model: {(q as DescQuestion).model_answer.slice(0, 120)}…
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => setPreviewQuestions(null)} style={{ ...btnBase, background: 'none', border: '1px solid var(--line)', color: 'var(--mute)' }}>
                    <Edit3 size={12} /> Regenerate
                  </button>
                </div>

                {/* Title + deadline */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={assignmentTitle}
                    onChange={e => setAssignmentTitle(e.target.value)}
                    placeholder="Assignment title…"
                    style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--ink)' }}
                  />
                  <input
                    type="datetime-local"
                    value={assignmentDeadline}
                    onChange={e => setAssignmentDeadline(e.target.value)}
                    style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--mute)' }}
                  />
                </div>

                <button
                  onClick={postAssignment}
                  disabled={posting || !assignmentTitle.trim()}
                  style={{ ...btnBase, justifyContent: 'center', padding: '9px 0', background: 'oklch(0.55 0.18 145 / 0.15)', border: '1px solid oklch(0.55 0.18 145 / 0.3)', color: 'oklch(0.72 0.18 145)' }}
                >
                  {posting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
                  {posting ? 'Posting…' : 'Post Assignment'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Assignment list */}
      {assignments.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 0', gap: 10,
          border: '1px dashed var(--line)', borderRadius: 14,
          color: 'var(--mute)', fontSize: 13, fontFamily: 'var(--font-mono)',
        }}>
          <ClipboardList size={28} style={{ opacity: 0.3 }} />
          No assignments yet.{isTeacher && ' Use "AI Generate Assignment" above.'}
        </div>
      ) : (
        assignments.map((a, i) => {
          const submitted = submissionMap[a.id]
          const overdue = a.deadline && new Date(a.deadline) < new Date()
          const expanded = expandedId === a.id
          const subData = submissionsData[a.id]

          return (
            <div key={a.id} style={{
              borderRadius: 12, overflow: 'hidden',
              background: 'linear-gradient(180deg, rgba(21,21,29,0.75), rgba(15,15,21,0.75))',
              border: '1px solid var(--line)',
              animationDelay: `${i * 60}ms`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                      {a.title}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 99, fontSize: 10, fontFamily: 'var(--font-mono)',
                      color: a.type === 'mcq' ? 'var(--purple-2)' : 'hsl(38 92% 65%)',
                      border: a.type === 'mcq' ? '1px solid oklch(0.42 0.18 295 / 0.4)' : '1px solid hsl(38 92% 50% / 0.4)',
                      background: a.type === 'mcq' ? 'oklch(0.42 0.18 295 / 0.1)' : 'hsl(38 92% 50% / 0.1)',
                    }}>
                      {a.type === 'mcq' ? 'MCQ' : 'Descriptive'}
                    </span>
                  </div>
                  {a.description && (
                    <p style={{ fontSize: 12, color: 'var(--mute)', margin: '4px 0', fontFamily: 'var(--font-mono)' }}>
                      {a.description}
                    </p>
                  )}
                  {a.deadline && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5, marginTop: 6,
                      fontSize: 11, fontFamily: 'var(--font-mono)',
                      color: overdue && !submitted ? 'hsl(0 85% 70%)' : 'var(--mute)',
                    }}>
                      <Clock size={11} />
                      Due: {new Date(a.deadline).toLocaleString()}
                      {overdue && !submitted && !isTeacher && ' — Overdue'}
                    </div>
                  )}
                </div>

                {isTeacher ? (
                  <button
                    onClick={() => toggleSubmissions(a.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                      background: 'var(--bg-3)', border: '1px solid var(--line)',
                      color: 'var(--mute)', fontSize: 11, fontFamily: 'var(--font-sans)', flexShrink: 0,
                    }}
                  >
                    {submissionsLoading === a.id
                      ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      : <><Eye size={12} />{subData ? `${subData.submissions?.length ?? 0} submitted` : 'Submissions'}{expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}</>
                    }
                  </button>
                ) : submitted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'oklch(0.72 0.18 145)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                    <CheckCircle size={13} />
                    {submitted.score != null ? `${submitted.score}%` : 'Submitted'}
                  </div>
                ) : (
                  <Link href={`/assignment/${a.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                    <button style={{
                      padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                      background: 'oklch(0.72 0.18 145 / 0.1)', border: '1px solid oklch(0.72 0.18 145 / 0.25)',
                      color: 'oklch(0.72 0.18 145)', fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 500,
                    }}>
                      Start
                    </button>
                  </Link>
                )}
              </div>

              {/* Submissions list for teacher */}
              {isTeacher && expanded && subData && (
                <div style={{ borderTop: '1px solid var(--line)' }}>
                  {subData.submissions?.length === 0 ? (
                    <p style={{ padding: '12px 16px', fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>No submissions yet.</p>
                  ) : (
                    subData.submissions?.map((sub: any, si: number) => (
                      <div key={sub.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                        borderBottom: si < subData.submissions.length - 1 ? '1px solid var(--line)' : 'none',
                        background: si % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          background: 'oklch(0.42 0.18 295 / 0.15)', color: 'var(--purple-2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600,
                        }}>
                          {(sub.student_email ?? '?')[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--ink-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sub.student_email}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                          {new Date(sub.submitted_at).toLocaleDateString()}
                        </span>
                        {sub.score != null ? (
                          <span style={{
                            fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', width: 36, textAlign: 'right', flexShrink: 0,
                            color: sub.score >= 70 ? 'oklch(0.72 0.18 145)' : sub.score >= 40 ? 'hsl(38 92% 65%)' : 'hsl(0 85% 70%)',
                          }}>
                            {sub.score}%
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--mute)', width: 36, textAlign: 'right', flexShrink: 0 }}>—</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
