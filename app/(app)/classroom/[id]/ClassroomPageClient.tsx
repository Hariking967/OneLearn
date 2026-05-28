'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, GraduationCap, Megaphone, ClipboardList,
  Users, Video, FolderOpen, Brain,
} from 'lucide-react'
import { AnnouncementsTab } from '@/components/classroom/tabs/AnnouncementsTab'
import { AssignmentsTab } from '@/components/classroom/tabs/AssignmentsTab'
import { StudentsTab } from '@/components/classroom/tabs/StudentsTab'
import { VideoMeetTab } from '@/components/classroom/tabs/VideoMeetTab'
import { ResourcesTab } from '@/components/classroom/tabs/ResourcesTab'
import { OneAITab } from '@/components/classroom/tabs/OneAITab'
import { AddStudentDialog } from '@/components/classroom/AddStudentDialog'
import type { Classroom, ClassroomAssignment, AssignmentSubmission } from '@/lib/supabase/types'

type Tab = 'announcements' | 'assignments' | 'students' | 'meet' | 'resources' | 'oneai'

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
  mySubmissions: AssignmentSubmission[]
  isTeacher: boolean
  currentUserId: string
  currentUserName: string
}

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'announcements', label: 'Announcements', icon: Megaphone },
  { key: 'assignments',   label: 'Assignments',   icon: ClipboardList },
  { key: 'students',      label: 'Students',      icon: Users },
  { key: 'meet',          label: 'Video Meet',    icon: Video },
  { key: 'resources',     label: 'Resources',     icon: FolderOpen },
  { key: 'oneai',         label: 'OneAI',         icon: Brain },
]

export function ClassroomPageClient({
  classroom,
  members: initialMembers,
  assignments: initialAssignments,
  mySubmissions,
  isTeacher,
  currentUserId,
  currentUserName,
}: Props) {
  const [tab, setTab] = useState<Tab>('announcements')
  const [assignments, setAssignments] = useState(initialAssignments)
  const [members, setMembers] = useState(initialMembers)

  async function reloadMembers() {
    const res = await fetch(`/api/classrooms/${classroom.id}/members`)
    if (res.ok) setMembers(await res.json())
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 56px)' }}>

      {/* Header */}
      <header style={{
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
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)' }}
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
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8,
            background: 'var(--bg-3)', border: '1px solid var(--line)',
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--mute)',
            flexShrink: 0,
          }}>
            <span>invite:</span>
            <span style={{ color: 'var(--ink-2)', letterSpacing: '0.08em' }}>{classroom.invite_code}</span>
          </div>
        )}

        {isTeacher && tab === 'students' && (
          <AddStudentDialog classroomId={classroom.id} onAdded={reloadMembers} />
        )}
      </header>

      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '8px 24px',
        borderBottom: '1px solid var(--line)',
        background: 'rgba(15,15,21,0.6)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0, overflowX: 'auto',
      }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              background: tab === key ? 'oklch(0.42 0.18 295 / 0.15)' : 'none',
              border: tab === key ? '1px solid oklch(0.42 0.18 295 / 0.3)' : '1px solid transparent',
              color: tab === key ? 'var(--purple-2)' : 'var(--mute)',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        flex: 1,
        overflowY: tab === 'oneai' ? 'hidden' : 'auto',
        padding: tab === 'oneai' ? 0 : 24,
      }}>
        {tab === 'announcements' && (
          <AnnouncementsTab
            classroomId={classroom.id}
            isTeacher={isTeacher}
            currentUserId={currentUserId}
          />
        )}
        {tab === 'assignments' && (
          <AssignmentsTab
            classroomId={classroom.id}
            isTeacher={isTeacher}
            initialAssignments={assignments}
            mySubmissions={mySubmissions}
            onCreated={a => setAssignments(p => [a, ...p])}
          />
        )}
        {tab === 'students' && (
          <StudentsTab
            classroomId={classroom.id}
            isTeacher={isTeacher}
            initialMembers={members}
            onReload={reloadMembers}
          />
        )}
        {tab === 'meet' && (
          <VideoMeetTab
            classroomId={classroom.id}
            isTeacher={isTeacher}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        )}
        {tab === 'resources' && (
          <ResourcesTab
            classroomId={classroom.id}
            isTeacher={isTeacher}
          />
        )}
        {tab === 'oneai' && (
          <OneAITab
            classroomId={classroom.id}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  )
}
