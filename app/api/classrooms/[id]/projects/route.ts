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

  // Check if user is the classroom owner
  const { data: classroom } = await supabase
    .from('classrooms').select('teacher_id').eq('id', id).single()
  const isTeacher = classroom?.teacher_id === user.id

  if (isTeacher) {
    const { data } = await supabase
      .from('classroom_projects')
      .select('*, projects(*)')
      .eq('classroom_id', id)
    return NextResponse.json(data ?? [])
  } else {
    const { data } = await supabase
      .from('student_project_copies')
      .select('*, classroom_projects!inner(classroom_id), projects(*)')
      .eq('classroom_projects.classroom_id', id)
      .eq('student_id', user.id)
    return NextResponse.json(data ?? [])
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await request.json()
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  // Add project to classroom
  const { data: cp, error } = await supabase
    .from('classroom_projects')
    .upsert({ classroom_id: id, project_id: projectId })
    .select().single()
  if (error || !cp) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })

  // Create copies for all existing members
  const { data: members } = await supabase.from('classroom_members').select('student_id').eq('classroom_id', id)
  const { data: srcProject } = await adminSupabase.from('projects').select('*').eq('id', projectId).single()
  if (!srcProject) return NextResponse.json({ success: true })

  for (const member of members ?? []) {
    const { data: existing } = await adminSupabase
      .from('student_project_copies')
      .select('id').eq('classroom_project_id', cp.id).eq('student_id', member.student_id).single()
    if (existing) continue

    const { data: newProject } = await adminSupabase
      .from('projects')
      .insert({ user_id: member.student_id, name: srcProject.name, description: srcProject.description, main_topic: srcProject.main_topic })
      .select().single()
    if (!newProject) continue

    const { data: topics } = await adminSupabase.from('topics').select('*').eq('project_id', projectId)
    const topicIdMap: Record<string, string> = {}
    for (const t of topics ?? []) {
      const { data: nt } = await adminSupabase
        .from('topics')
        .insert({ project_id: newProject.id, name: t.name, description: t.description, status: 'unlocked' })
        .select().single()
      if (nt) topicIdMap[t.id] = nt.id
    }
    const { data: edges } = await adminSupabase.from('topic_edges').select('*').in('parent_id', Object.keys(topicIdMap))
    const newEdges = (edges ?? []).filter(e => topicIdMap[e.parent_id] && topicIdMap[e.child_id])
      .map(e => ({ parent_id: topicIdMap[e.parent_id], child_id: topicIdMap[e.child_id] }))
    if (newEdges.length) await adminSupabase.from('topic_edges').insert(newEdges)

    await adminSupabase.from('student_project_copies').insert({
      classroom_project_id: cp.id,
      student_id: member.student_id,
      project_id: newProject.id,
    })

    await adminSupabase.from('notifications').insert({
      user_id: member.student_id,
      type: 'classroom_project_added',
      title: 'New project in your classroom',
      body: `"${srcProject.name}" has been added to your classroom.`,
      data: { project_id: newProject.id },
    })
  }

  return NextResponse.json({ success: true })
}
