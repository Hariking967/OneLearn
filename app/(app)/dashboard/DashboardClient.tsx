'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trash2, ArrowRight, GraduationCap } from 'lucide-react'
import { CreateProjectDialog } from '@/components/project/CreateProjectDialog'
import { StudyDigest } from '@/components/StudyDigest'
import { ProjectCanvas } from '@/components/ProjectCanvas'
import type { Project } from '@/lib/supabase/types'

function projectHue(id: string): number {
  let h = 0
  for (const c of id) h = ((h << 5) - h + c.charCodeAt(0)) | 0
  return 250 + (Math.abs(h) % 80)
}

interface Props {
  initialProjects: Project[]
  createdClassrooms?: number
  joinedClassrooms?: number
}

export function DashboardClient({ initialProjects, createdClassrooms = 0, joinedClassrooms = 0 }: Props) {
  const [projects, setProjects] = useState(initialProjects)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
    setProjects(p => p.filter(proj => proj.id !== id))
    setDeletingId(null)
  }

  const totalClassrooms = createdClassrooms + joinedClassrooms

  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 1320, position: 'relative', zIndex: 1 }}>

      {/* Header row */}
      <div className="animate-fade-up" style={{ marginBottom: 10 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          {projects.length > 0 ? `${projects.length} project${projects.length !== 1 ? 's' : ''}` : 'get started'}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em', margin: 0 }}>
            Your <em style={{ fontStyle: 'italic', color: 'var(--purple-2)' }}>learning</em><br />
            <span style={{ color: 'var(--ink-2)' }}>projects.</span>
          </h1>
          <CreateProjectDialog />
        </div>
      </div>

      {/* Divider */}
      <div className="animate-fade-in delay-100" style={{ height: 1, background: 'linear-gradient(90deg, oklch(0.68 0.19 295 / 0.35), transparent)', margin: '24px 0' }} />

      {/* Classroom banner */}
      {totalClassrooms > 0 && (
        <div className="animate-fade-up delay-150" style={{ marginBottom: 28 }}>
          <Link href="/classrooms" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px', borderRadius: 12,
              background: 'oklch(0.68 0.19 295 / 0.06)',
              border: '1px solid oklch(0.68 0.19 295 / 0.2)',
              cursor: 'pointer', transition: 'border-color 0.18s',
            }}>
              <GraduationCap style={{ width: 18, height: 18, color: 'var(--purple-2)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--purple-2)', fontFamily: 'var(--font-sans)' }}>
                  {[
                    createdClassrooms > 0 && `${createdClassrooms} created`,
                    joinedClassrooms > 0 && `${joinedClassrooms} joined`,
                  ].filter(Boolean).join(' · ')}{' '}classroom{totalClassrooms !== 1 ? 's' : ''}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'oklch(0.68 0.19 295 / 0.6)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  Manage students and assignments →
                </p>
              </div>
              <ArrowRight style={{ width: 14, height: 14, color: 'oklch(0.68 0.19 295 / 0.5)', flexShrink: 0 }} />
            </div>
          </Link>
        </div>
      )}

      {/* Study digest */}
      {projects.length > 0 && (
        <div className="animate-fade-up delay-200" style={{ marginBottom: 28 }}>
          <StudyDigest />
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 ? (
        <div className="animate-scale-in delay-300" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', textAlign: 'center' }}>
          <div style={{ position: 'relative', marginBottom: 32 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, var(--purple-glow), transparent 65%)', transform: 'scale(2.2)', filter: 'blur(20px)' }} />
            <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 18, background: 'oklch(0.42 0.18 295 / 0.12)', border: '1px solid oklch(0.68 0.19 295 / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--purple-2)" strokeWidth="1.4"><circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M12 8v0M12 16v0M8 12h0M16 12h0"/></svg>
            </div>
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, margin: '0 0 10px' }}>
            No projects <em style={{ fontStyle: 'italic', color: 'var(--purple-2)' }}>yet.</em>
          </h2>
          <p style={{ fontSize: 13, color: 'var(--mute)', maxWidth: 360, lineHeight: 1.6, marginBottom: 28 }}>
            Add a topic and AI will build a personalised prerequisite knowledge graph to guide your learning journey.
          </p>
          <CreateProjectDialog />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
          {projects.map((project, i) => {
            const hue = projectHue(project.id)
            return (
              <div
                key={project.id}
                className="project-card animate-fade-up"
                style={{ animationDelay: `${i * 65 + 200}ms` }}
              >
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(project.id)}
                  disabled={deletingId === project.id}
                  style={{
                    position: 'absolute', top: 10, right: 10, zIndex: 2,
                    opacity: 0, transition: 'opacity 0.18s',
                    padding: '5px', borderRadius: 7,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--mute)',
                  }}
                  className="card-delete-btn"
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'hsl(0 85% 70%)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)'}
                >
                  <Trash2 size={13} />
                </button>

                {/* Thumbnail */}
                <div style={{ height: 130, position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--line)' }}>
                  <ProjectCanvas hue={hue} seed={project.id} />
                  {/* Italic glyph overlay */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 72, color: `hsl(${hue} 60% 75% / 0.18)`, userSelect: 'none', pointerEvents: 'none' }}>
                    {project.name[0]}
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 18px 18px' }}>
                  {/* Chips */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span className="chip chip-active">Active</span>
                    {project.main_topic && (
                      <span className="chip" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {project.main_topic}
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.01em', margin: '0 0 6px', color: 'var(--ink)' }}>
                    {project.name}
                  </h3>

                  {project.description && (
                    <p style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.55, margin: '0 0 16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {project.description}
                    </p>
                  )}

                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: project.description ? 0 : 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      #{project.id.slice(0, 8)}
                    </div>
                    <Link href={`/project/${project.id}`} style={{ textDecoration: 'none' }}>
                      <button style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 12px', borderRadius: 9,
                        background: `hsl(${hue} 50% 40% / 0.12)`,
                        border: `1px solid hsl(${hue} 50% 60% / 0.2)`,
                        color: `hsl(${hue} 70% 72%)`,
                        fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
                        cursor: 'pointer', transition: 'all 0.18s',
                      }}>
                        Open
                        <ArrowRight size={12} style={{ transition: 'transform 0.18s' }} />
                      </button>
                    </Link>
                  </div>
                </div>

                {/* Hover shimmer orb */}
                <div className="shimmer-orb" style={{ background: `radial-gradient(circle, hsl(${hue} 70% 60% / 0.25), transparent 65%)` }} />
              </div>
            )
          })}

          {/* New project tile */}
          <div className="animate-fade-up" style={{ animationDelay: `${projects.length * 65 + 200}ms` }}>
            <CreateProjectDialog>
              <button style={{
                width: '100%', minHeight: 250, borderRadius: 14,
                border: '1px dashed var(--line)',
                background: 'rgba(255,255,255,0.01)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                cursor: 'pointer', transition: 'border-color 0.18s, background 0.18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'oklch(0.68 0.19 295 / 0.4)'; (e.currentTarget as HTMLButtonElement).style.background = 'oklch(0.42 0.18 295 / 0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.01)'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, border: '1px dashed oklch(0.68 0.19 295 / 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.68 0.19 295 / 0.5)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  New project
                </span>
              </button>
            </CreateProjectDialog>
          </div>
        </div>
      )}
    </div>
  )
}
