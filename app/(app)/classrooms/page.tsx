import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { ClassroomsPageClient } from './ClassroomsPageClient'

export default async function ClassroomsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use admin client to bypass RLS cross-table recursion on classroom policies
  const [createdRes, joinedRes] = await Promise.all([
    adminSupabase
      .from('classrooms')
      .select('*, classroom_members(count), classroom_projects(count)')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false }),
    adminSupabase
      .from('classroom_members')
      .select('classroom_id, classrooms(*, classroom_projects(count))')
      .eq('student_id', user.id),
  ])

  const created = createdRes.data ?? []
  const joined = (joinedRes.data ?? []).map((m: any) => m.classrooms).filter(Boolean)

  return <ClassroomsPageClient created={created} joined={joined} />
}
