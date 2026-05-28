import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@/lib/db/projects'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [projects, createdRes, joinedRes] = await Promise.all([
    getProjects(user!.id),
    supabase.from('classrooms').select('*', { count: 'exact', head: true }).eq('teacher_id', user!.id),
    supabase.from('classroom_members').select('*', { count: 'exact', head: true }).eq('student_id', user!.id),
  ])

  return (
    <DashboardClient
      initialProjects={projects}
      createdClassrooms={createdRes.count ?? 0}
      joinedClassrooms={joinedRes.count ?? 0}
    />
  )
}
