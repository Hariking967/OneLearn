'use client'

import { useState } from 'react'
import { GraduationCap, Users } from 'lucide-react'
import { CreateClassroomDialog } from '@/components/classroom/CreateClassroomDialog'
import { ClassroomCard } from '@/components/classroom/ClassroomCard'

interface Props {
  created: any[]
  joined: any[]
}

export function ClassroomsPageClient({ created: initialCreated, joined: initialJoined }: Props) {
  const [created, setCreated] = useState(initialCreated)
  const [joined] = useState(initialJoined)

  async function handleDelete(id: string) {
    await fetch(`/api/classrooms?id=${id}`, { method: 'DELETE' })
    setCreated(c => c.filter(x => x.id !== id))
  }

  const total = created.length + joined.length

  return (
    <div style={{ padding: '40px 40px 60px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="animate-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Classrooms</div>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 400,
            color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1,
          }}>
            Your <em style={{ fontStyle: 'italic', color: 'var(--purple-2)' }}>classrooms</em>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mute)', margin: 0, fontFamily: 'var(--font-mono)' }}>
            {total === 0
              ? 'Create a classroom or join one with an invite code'
              : `${created.length} created · ${joined.length} joined`}
          </p>
        </div>
        <div className="animate-fade-up" style={{ animationDelay: '100ms', flexShrink: 0 }}>
          <CreateClassroomDialog onCreated={c => setCreated(prev => [c, ...prev])} />
        </div>
      </div>

      {/* Divider */}
      <div className="animate-fade-in" style={{
        height: 1, marginBottom: 36,
        background: 'linear-gradient(90deg, hsl(38 92% 50% / 0.35), transparent)',
        animationDelay: '150ms',
      }} />

      {total === 0 ? (
        <div className="animate-scale-in" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 0', textAlign: 'center', animationDelay: '200ms',
        }}>
          <div style={{ position: 'relative', marginBottom: 28 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'hsl(38 92% 50% / 0.15)', transform: 'scale(1.8)',
              filter: 'blur(20px)',
            }} />
            <div style={{
              position: 'relative', width: 68, height: 68, borderRadius: 18,
              background: 'hsl(38 92% 50% / 0.1)',
              border: '1px solid hsl(38 92% 50% / 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GraduationCap size={28} color="hsl(38 92% 65%)" />
            </div>
          </div>
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400,
            color: 'var(--ink)', margin: '0 0 10px', letterSpacing: '-0.01em',
          }}>
            No classrooms yet
          </h2>
          <p style={{ fontSize: 13, color: 'var(--mute)', maxWidth: 340, margin: '0 0 28px', lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>
            Create a classroom to manage students and assignments, or ask for an invite code to join one.
          </p>
          <CreateClassroomDialog onCreated={c => setCreated(prev => [c, ...prev])} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
          {created.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <GraduationCap size={14} color="hsl(38 92% 55%)" />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase',
                  letterSpacing: '0.14em', color: 'hsl(38 92% 55%)',
                }}>
                  Created by me
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 99, fontSize: 10,
                  background: 'hsl(38 92% 50% / 0.1)',
                  color: 'hsl(38 92% 60%)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {created.length}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {created.map((classroom, i) => (
                  <ClassroomCard
                    key={classroom.id}
                    classroom={classroom}
                    isTeacher={true}
                    onDelete={handleDelete}
                    animDelay={i * 75 + 100}
                  />
                ))}
              </div>
            </section>
          )}

          {joined.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <Users size={14} color="oklch(0.78 0.13 295)" />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase',
                  letterSpacing: '0.14em', color: 'oklch(0.78 0.13 295)',
                }}>
                  Joined
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 99, fontSize: 10,
                  background: 'oklch(0.42 0.18 295 / 0.12)',
                  color: 'oklch(0.78 0.13 295)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {joined.length}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {joined.map((classroom, i) => (
                  <ClassroomCard
                    key={classroom.id}
                    classroom={classroom}
                    isTeacher={false}
                    animDelay={i * 75 + 100}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
