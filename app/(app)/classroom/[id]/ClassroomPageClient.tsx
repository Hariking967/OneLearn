'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, GraduationCap, Users, BookOpen, ClipboardList,
  FolderOpen, ArrowRight, Clock, CheckCircle, Loader2, Trash2, ExternalLink,
  ChevronDown, ChevronUp, Eye, MessageSquare
} from 'lucide-react'
import { AddStudentDialog } from '@/components/classroom/AddStudentDialog'
import { AssignmentCreatorDialog } from '@/components/classroom/AssignmentCreatorDialog'
import { AssignmentReportDialog } from '@/components/classroom/AssignmentReportDialog'
import { FeedTab } from '@/components/classroom/FeedTab'
import type { Classroom, ClassroomAssignment, AssignmentSubmission } from '@/lib/supabase/types'

interface Member {
  id: string
  student_id: string
  joined_at: string
  email: string
  user_profiles?: { display_name: string | null; role: string }
}

interface Props {
  classroom: Classroom
  members: Member[]
  assignments: ClassroomAssignment[]
  projects: any[]
  mySubmissions: AssignmentSubmission[]
  isTeacher: boolean
  currentUserId: string
}

type Tab = 'projects' | 'assignments' | 'members' | 'feed'

export function ClassroomPageClient({
  classroom, members: initialMembers, assignments: initialAssignments,
  projects, mySubmissions, isTeacher, currentUserId
}: Props) {
  const [tab, setTab] = useState<Tab>('projects')
  const [assignments, setAssignments] = useState(initialAssignments)
  const [members, setMembers] = useState(initialMembers)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null)
  const [submissionsData, setSubmissionsData] = useState<Record<string, any>>({})
  const [submissionsLoading, setSubmissionsLoading] = useState<string | null>(null)

  const submissionMap: Record<string, AssignmentSubmission> = {}
  for (const s of mySubmissions) submissionMap[s.assignment_id] = s

  async function reloadMembers() {
    const res = await fetch(`/api/classrooms/${classroom.id}/members`)
    if (res.ok) setMembers(await res.json())
  }

  async function removeStudent(studentId: string) {
    setRemovingId(studentId)
    try {
      await fetch(`/api/classrooms/${classroom.id}/members?studentId=${studentId}`, { method: 'DELETE' })
      setMembers(m => m.filter(x => x.student_id !== studentId))
    } finally {
      setRemovingId(null)
    }
  }

  async function toggleAssignmentSubmissions(assignmentId: string) {
    if (expandedAssignment === assignmentId) {
      setExpandedAssignment(null)
      return
    }
    setExpandedAssignment(assignmentId)
    if (submissionsData[assignmentId]) return
    setSubmissionsLoading(assignmentId)
    try {
      const res = await fetch(`/api/classrooms/${classroom.id}/assignments/${assignmentId}/submissions`)
      if (res.ok) {
        const data = await res.json()
        setSubmissionsData(d => ({ ...d, [assignmentId]: data }))
      }
    } finally {
      setSubmissionsLoading(null)
    }
  }

  const tabs = isTeacher
    ? [
        { key: 'projects' as Tab, label: 'Projects', icon: BookOpen },
        { key: 'assignments' as Tab, label: 'Assignments', icon: ClipboardList },
        { key: 'members' as Tab, label: 'Students', icon: Users },
        { key: 'feed' as Tab, label: 'Feed', icon: MessageSquare },
      ]
    : [
        { key: 'projects' as Tab, label: 'Projects', icon: BookOpen },
        { key: 'assignments' as Tab, label: 'Assignments', icon: ClipboardList },
        { key: 'feed' as Tab, label: 'Feed', icon: MessageSquare },
      ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <header className="animate-fade-down" style={{
        borderBottom: '1px solid var(--line)',
        background: 'rgba(15,15,21,0.8)',
        backdropFilter: 'blur(12px)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
      }}>
        <Link href="/classrooms">
          <button style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 9, background: 'none', border: '1px solid var(--line)',
            color: 'var(--mute)', cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)' }}
          >
            <ChevronLeft size={15} />
          </button>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'hsl(38 92% 50% / 0.1)',
            border: '1px solid hsl(38 92% 50% / 0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GraduationCap size={15} color="hsl(38 92% 65%)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 400,
              color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {classroom.name}
            </h1>
            {classroom.description && (
              <p style={{ fontSize: 11, color: 'var(--mute)', margin: 0, fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                {classroom.description}
              </p>
            )}
          </div>
        </div>
        {isTeacher && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
            background: 'var(--bg-3)', border: '1px solid var(--line)',
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--mute)',
            flexShrink: 0,
          }}>
            <span>invite:</span>
            <span style={{ color: 'var(--ink-2)', letterSpacing: '0.08em' }}>{classroom.invite_code}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isTeacher && tab === 'members' && (
            <AddStudentDialog classroomId={classroom.id} onAdded={reloadMembers} />
          )}
          {isTeacher && tab === 'assignments' && (
            <AssignmentCreatorDialog classroomId={classroom.id} onCreated={a => setAssignments(prev => [a, ...prev])} />
          )}
        </div>
      </header>

      {/* Tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '8px 24px',
        borderBottom: '1px solid var(--line)',
        background: 'rgba(15,15,21,0.6)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
      }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 500,
              transition: 'all 0.15s',
              background: tab === key ? 'oklch(0.42 0.18 295 / 0.15)' : 'none',
              border: tab === key ? '1px solid oklch(0.42 0.18 295 / 0.3)' : '1px solid transparent',
              color: tab === key ? 'var(--purple-2)' : 'var(--mute)',
            }}
          >
            <Icon size={13} />
            {label}
            {key === 'members' && isTeacher && members.length > 0 && (
              <span style={{
                padding: '1px 6px', borderRadius: 99, fontSize: 10,
                background: 'oklch(0.42 0.18 295 / 0.15)',
                color: 'var(--purple-2)', fontFamily: 'var(--font-mono)',
              }}>
                {members.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* PROJECTS */}
        {tab === 'projects' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {projects.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '80px 0', gap: 10,
                border: '1px dashed var(--line)', borderRadius: 14,
                color: 'var(--mute)', fontSize: 13, fontFamily: 'var(--font-mono)',
              }}>
                <FolderOpen size={28} style={{ opacity: 0.3 }} />
                {isTeacher
                  ? 'No projects yet. Open a project and use "Assign to classroom" to add it here.'
                  : 'No projects in this classroom yet.'}
              </div>
            ) : (
              projects.map((p: any, i: number) => {
                const proj = p.projects ?? p
                return (
                  <div key={p.id || proj.id} className="project-card animate-fade-up"
                       style={{ animationDelay: `${i * 60}ms` }}>
                    <div style={{ height: 4, borderTopLeftRadius: 14, borderTopRightRadius: 14, background: 'linear-gradient(90deg, var(--purple), oklch(0.55 0.18 295 / 0.5))' }} />
                    <div style={{ padding: '16px 18px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                          background: 'oklch(0.42 0.18 295 / 0.12)',
                          border: '1px solid oklch(0.42 0.18 295 / 0.22)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <FolderOpen size={14} color="var(--purple-2)" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{
                            fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 400,
                            color: 'var(--ink)', margin: '0 0 2px', letterSpacing: '-0.01em',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {proj.name}
                          </h3>
                          {proj.main_topic && (
                            <p style={{ fontSize: 11, color: 'var(--mute)', margin: 0, fontFamily: 'var(--font-mono)' }}>
                              {proj.main_topic}
                            </p>
                          )}
                        </div>
                      </div>
                      <Link href={`/project/${proj.id}`} style={{ textDecoration: 'none' }}>
                        <button style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                          padding: '8px 0', borderRadius: 9,
                          background: 'oklch(0.42 0.18 295 / 0.08)',
                          border: '1px solid oklch(0.42 0.18 295 / 0.18)',
                          color: 'var(--purple-2)',
                          fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 500,
                          cursor: 'pointer',
                        }}>
                          Open <ArrowRight size={12} />
                        </button>
                      </Link>
                    </div>
                    <div className="shimmer-orb" style={{ background: 'radial-gradient(circle, oklch(0.68 0.19 295 / 0.18), transparent 65%)' }} />
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ASSIGNMENTS */}
        {tab === 'assignments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
            {assignments.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '80px 0', gap: 10,
                border: '1px dashed var(--line)', borderRadius: 14,
                color: 'var(--mute)', fontSize: 13, fontFamily: 'var(--font-mono)',
              }}>
                <ClipboardList size={28} style={{ opacity: 0.3 }} />
                No assignments yet.{isTeacher && ' Use "Create assignment" to add one.'}
              </div>
            ) : (
              assignments.map((a, i) => {
                const submitted = submissionMap[a.id]
                const overdue = a.deadline && new Date(a.deadline) < new Date()
                const expanded = expandedAssignment === a.id
                const subData = submissionsData[a.id]
                const submittedCount = subData?.submissions?.length ?? 0

                return (
                  <div key={a.id} className="animate-fade-up"
                       style={{
                         borderRadius: 12, overflow: 'hidden',
                         background: 'linear-gradient(180deg, rgba(21,21,29,0.75), rgba(15,15,21,0.75))',
                         border: '1px solid var(--line)',
                         animationDelay: `${i * 60}ms`,
                       }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{
                            fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)',
                            letterSpacing: '-0.01em',
                          }}>
                            {a.title}
                          </span>
                          <span className="chip" style={{
                            color: a.type === 'mcq' ? 'var(--purple-2)' : 'hsl(38 92% 65%)',
                            borderColor: a.type === 'mcq' ? 'oklch(0.42 0.18 295 / 0.4)' : 'hsl(38 92% 50% / 0.4)',
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
                        {isTeacher && Array.isArray(a.questions) && (
                          <p style={{ fontSize: 11, color: 'var(--mute)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
                            {(a.questions as any[]).length} question{(a.questions as any[]).length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>

                      {isTeacher ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          <AssignmentReportDialog classroomId={classroom.id} assignmentId={a.id} assignmentTitle={a.title} />
                          <button
                            onClick={() => toggleAssignmentSubmissions(a.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                              background: 'var(--bg-3)', border: '1px solid var(--line)',
                              color: 'var(--mute)', fontSize: 11, fontFamily: 'var(--font-sans)',
                              flexShrink: 0,
                            }}
                          >
                            {submissionsLoading === a.id ? (
                              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <>
                                <Eye size={12} />
                                {subData ? `${submittedCount} submitted` : 'Submissions'}
                                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </>
                            )}
                          </button>
                        </div>
                      ) : submitted ? (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          fontSize: 12, color: 'oklch(0.72 0.18 145)', flexShrink: 0,
                          fontFamily: 'var(--font-mono)',
                        }}>
                          <CheckCircle size={13} />
                          {submitted.score != null ? `${submitted.score}%` : 'Submitted'}
                        </div>
                      ) : (
                        <Link href={`/assignment/${a.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                          <button style={{
                            padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                            background: 'oklch(0.72 0.18 145 / 0.1)',
                            border: '1px solid oklch(0.72 0.18 145 / 0.25)',
                            color: 'oklch(0.72 0.18 145)',
                            fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 500,
                          }}>
                            Start
                          </button>
                        </Link>
                      )}
                    </div>

                    {/* Submission list for teacher */}
                    {isTeacher && expanded && subData && (
                      <div style={{ borderTop: '1px solid var(--line)' }}>
                        {subData.submissions.length === 0 ? (
                          <p style={{ padding: '12px 16px', fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
                            No submissions yet.
                          </p>
                        ) : (
                          <div>
                            {subData.submissions.map((sub: any, si: number) => (
                              <div key={sub.id}
                                   style={{
                                     display: 'flex', alignItems: 'center', gap: 12,
                                     padding: '10px 16px',
                                     borderBottom: si < subData.submissions.length - 1 ? '1px solid var(--line)' : 'none',
                                     background: si % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                                   }}>
                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: 'oklch(0.42 0.18 295 / 0.15)',
                                  color: 'var(--purple-2)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 11, fontWeight: 600, flexShrink: 0,
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
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* MEMBERS (teacher) */}
        {tab === 'members' && isTeacher && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560 }}>
            {members.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '80px 0', gap: 10,
                border: '1px dashed var(--line)', borderRadius: 14,
                color: 'var(--mute)', fontSize: 13, fontFamily: 'var(--font-mono)',
              }}>
                <Users size={28} style={{ opacity: 0.3 }} />
                No students yet. Use "Add student" to invite by email.
              </div>
            ) : (
              members.map((m, i) => {
                const displayName = m.user_profiles?.display_name || m.email || `Student ${m.student_id.slice(0, 8)}`
                const initials = displayName[0].toUpperCase()
                return (
                  <div key={m.id} className="animate-fade-up"
                       style={{
                         display: 'flex', alignItems: 'center', gap: 12,
                         padding: '12px 16px', borderRadius: 12,
                         background: 'linear-gradient(180deg, rgba(21,21,29,0.75), rgba(15,15,21,0.75))',
                         border: '1px solid var(--line)',
                         animationDelay: `${i * 40}ms`,
                         position: 'relative',
                       }}
                       onMouseEnter={e => {
                         const del = (e.currentTarget as HTMLDivElement).querySelector('.member-delete') as HTMLButtonElement
                         if (del) del.style.opacity = '1'
                       }}
                       onMouseLeave={e => {
                         const del = (e.currentTarget as HTMLDivElement).querySelector('.member-delete') as HTMLButtonElement
                         if (del) del.style.opacity = '0'
                       }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: 'oklch(0.42 0.18 295 / 0.15)',
                      color: 'var(--purple-2)',
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
                    <StudentCopyLink classroomId={classroom.id} studentId={m.student_id} />
                    <button
                      className="member-delete"
                      onClick={() => removeStudent(m.student_id)}
                      disabled={removingId === m.student_id}
                      style={{
                        padding: 6, borderRadius: 7, opacity: 0,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--mute)', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'hsl(0 85% 70%)'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)'}
                      title="Remove student"
                    >
                      {removingId === m.student_id
                        ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Trash2 size={13} />
                      }
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* FEED */}
        {tab === 'feed' && (
          <FeedTab classroomId={classroom.id} isTeacher={isTeacher} currentUserId={currentUserId} />
        )}
      </div>
    </div>
  )
}

function StudentCopyLink({ classroomId, studentId }: { classroomId: string; studentId: string }) {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  async function fetchCopy() {
    if (fetched) return
    setLoading(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/student-copy?studentId=${studentId}`)
      if (res.ok) {
        const data = await res.json()
        setProjectId(data.project_id ?? null)
      }
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }

  if (!fetched) {
    return (
      <button
        onClick={fetchCopy}
        style={{
          padding: 6, borderRadius: 7, background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--mute)', opacity: 0, transition: 'all 0.15s',
        }}
        className="member-delete"
        title="View student's copy"
      >
        {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ExternalLink size={13} />}
      </button>
    )
  }

  if (!projectId) return null

  return (
    <Link href={`/project/${projectId}`} target="_blank">
      <button
        style={{
          padding: 6, borderRadius: 7, background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--purple-2)', transition: 'all 0.15s',
        }}
        title="Open student's project"
      >
        <ExternalLink size={13} />
      </button>
    </Link>
  )
}
