import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { ClassroomPageClient } from './ClassroomPageClient'

const adminSupabase = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function ClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: classroom } = await supabase.from('classrooms').select('*').eq('id', id).single()
  if (!classroom) redirect('/classrooms')

  const isTeacher = (classroom.teacher_id === user.id)

  // Get members with user_profiles
  const { data: rawMembers } = await supabase
    .from('classroom_members')
    .select('*, user_profiles(display_name, role)')
    .eq('classroom_id', id)

  // Enrich members with emails via admin
  let members: any[] = rawMembers ?? []
  if (isTeacher && members.length > 0) {
    const { data: { users: authUsers } } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
    const emailMap: Record<string, string> = {}
    for (const u of authUsers) emailMap[u.id] = u.email ?? ''
    members = members.map(m => ({ ...m, email: emailMap[m.student_id] ?? '' }))
  }

  // Get assignments
  const { data: assignments } = await supabase
    .from('classroom_assignments')
    .select('*')
    .eq('classroom_id', id)
    .order('created_at', { ascending: false })

  // Student's own submissions
  const { data: mySubmissions } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('student_id', user.id)

  const { data: currentProfile } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const currentUserName = currentProfile?.display_name ?? user.email?.split('@')[0] ?? 'You'

  return (
    <ClassroomPageClient
      classroom={classroom}
      members={members}
      assignments={assignments ?? []}
      mySubmissions={mySubmissions ?? []}
      isTeacher={isTeacher}
      currentUserId={user.id}
      currentUserName={currentUserName}
    />
  )
}
