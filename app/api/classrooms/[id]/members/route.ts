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

  const { data: members } = await supabase
    .from('classroom_members')
    .select('*, user_profiles(display_name, role)')
    .eq('classroom_id', id)

  if (!members) return NextResponse.json([])

  // Enrich with emails via admin
  const { data: { users: authUsers } } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of authUsers) emailMap[u.id] = u.email ?? ''

  const enriched = members.map(m => ({
    ...m,
    email: emailMap[m.student_id] ?? '',
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: classroom } = await supabase
    .from('classrooms').select('id, name').eq('id', id).eq('teacher_id', user.id).single()
  if (!classroom) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const { data: { users } } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
  const student = users.find(u => u.email?.toLowerCase() === email.toLowerCase().trim())
  if (!student) return NextResponse.json({ error: 'No user with that email' }, { status: 404 })
  if (student.id === user.id) return NextResponse.json({ error: 'Cannot add yourself as student' }, { status: 400 })

  // Ensure student has a profile
  await adminSupabase.from('user_profiles').upsert(
    { id: student.id, role: 'student' },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  const { error } = await supabase
    .from('classroom_members')
    .upsert({ classroom_id: id, student_id: student.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get classroom projects and create student copies
  const { data: classroomProjects } = await supabase
    .from('classroom_projects').select('*, projects(*)').eq('classroom_id', id)

  for (const cp of classroomProjects ?? []) {
    const { data: existing } = await adminSupabase
      .from('student_project_copies')
      .select('id').eq('classroom_project_id', cp.id).eq('student_id', student.id).single()
    if (existing) continue

    const srcProject = (cp as any).projects
    if (!srcProject) continue

    const { data: newProject } = await adminSupabase
      .from('projects')
      .insert({ user_id: student.id, name: srcProject.name, description: srcProject.description, main_topic: srcProject.main_topic })
      .select().single()
    if (!newProject) continue

    const { data: topics } = await adminSupabase.from('topics').select('*').eq('project_id', srcProject.id)
    const topicIdMap: Record<string, string> = {}
    for (const t of topics ?? []) {
      const { data: nt } = await adminSupabase
        .from('topics')
        .insert({ project_id: newProject.id, name: t.name, description: t.description, status: 'unlocked' })
        .select().single()
      if (nt) topicIdMap[t.id] = nt.id
    }
    const { data: edges } = await adminSupabase.from('topic_edges').select('*').in('parent_id', Object.keys(topicIdMap).length > 0 ? Object.keys(topicIdMap) : ['__none__'])
    const newEdges = (edges ?? []).filter(e => topicIdMap[e.parent_id] && topicIdMap[e.child_id])
      .map(e => ({ parent_id: topicIdMap[e.parent_id], child_id: topicIdMap[e.child_id] }))
    if (newEdges.length) await adminSupabase.from('topic_edges').insert(newEdges)

    await adminSupabase.from('student_project_copies').insert({
      classroom_project_id: cp.id,
      student_id: student.id,
      project_id: newProject.id,
    })
  }

  await adminSupabase.from('notifications').insert({
    user_id: student.id,
    type: 'classroom_invite',
    title: 'Added to a classroom',
    body: `You've been added to "${classroom.name}".`,
    data: { classroom_id: id },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Must be teacher of this classroom
  const { data: classroom } = await supabase
    .from('classrooms').select('id').eq('id', id).eq('teacher_id', user.id).single()
  if (!classroom) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId')
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

  await supabase.from('classroom_members')
    .delete().eq('classroom_id', id).eq('student_id', studentId)

  return new NextResponse(null, { status: 204 })
}
