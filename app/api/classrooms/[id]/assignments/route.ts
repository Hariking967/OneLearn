import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const adminSupabase = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('classroom_assignments')
    .select('*')
    .eq('classroom_id', id)
    .order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { classroom } = await supabase
    .from('classrooms').select('id, name').eq('id', id).eq('teacher_id', user.id).single() as any
  if (!classroom) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await request.json()
  const { title, description, type, questions, deadline, projectId } = body
  if (!title || !type) return NextResponse.json({ error: 'title and type required' }, { status: 400 })

  const { data: assignment, error } = await supabase
    .from('classroom_assignments')
    .insert({ classroom_id: id, project_id: projectId ?? null, title, description, type, questions: questions ?? null, deadline: deadline ?? null, created_by: user.id })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify all members
  const { data: members } = await supabase.from('classroom_members').select('student_id').eq('classroom_id', id)
  const { data: classroomData } = await supabase.from('classrooms').select('name').eq('id', id).single()
  const classroomName = classroomData?.name ?? 'your classroom'

  const notifications = (members ?? []).map(m => ({
    user_id: m.student_id,
    type: 'new_assignment',
    title: `New assignment: ${title}`,
    body: `A new ${type} assignment has been posted in ${classroomName}${deadline ? ` — due ${new Date(deadline).toLocaleDateString()}` : ''}.`,
    data: { assignment_id: assignment.id, classroom_id: id },
  }))
  if (notifications.length) await adminSupabase.from('notifications').insert(notifications)

  return NextResponse.json(assignment)
}
