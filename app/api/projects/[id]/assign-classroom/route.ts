import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const adminSupabase = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: project } = await supabase
    .from('projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { classroomId } = await request.json()
  if (!classroomId) return NextResponse.json({ error: 'classroomId required' }, { status: 400 })

  // Verify teacher owns classroom
  const { data: classroom } = await supabase
    .from('classrooms').select('id').eq('id', classroomId).eq('teacher_id', user.id).single()
  if (!classroom) return NextResponse.json({ error: 'Classroom not found' }, { status: 404 })

  // Add project to classroom
  const { data: cp, error: cpErr } = await supabase
    .from('classroom_projects')
    .upsert({ classroom_id: classroomId, project_id: projectId })
    .select().single()
  if (cpErr || !cp) return NextResponse.json({ error: cpErr?.message ?? 'Failed' }, { status: 500 })

  // Create student copies for all existing members
  const { data: members } = await supabase
    .from('classroom_members').select('student_id').eq('classroom_id', classroomId)

  for (const member of members ?? []) {
    const { data: existing } = await adminSupabase
      .from('student_project_copies')
      .select('id').eq('classroom_project_id', cp.id).eq('student_id', member.student_id).single()
    if (existing) continue

    const { data: newProject } = await adminSupabase
      .from('projects')
      .insert({ user_id: member.student_id, name: project.name, description: project.description, main_topic: project.main_topic })
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
    const srcIds = Object.keys(topicIdMap)
    if (srcIds.length > 0) {
      const { data: edges } = await adminSupabase.from('topic_edges').select('*').in('parent_id', srcIds)
      const newEdges = (edges ?? []).filter(e => topicIdMap[e.parent_id] && topicIdMap[e.child_id])
        .map(e => ({ parent_id: topicIdMap[e.parent_id], child_id: topicIdMap[e.child_id] }))
      if (newEdges.length) await adminSupabase.from('topic_edges').insert(newEdges)
    }

    await adminSupabase.from('student_project_copies').insert({
      classroom_project_id: cp.id,
      student_id: member.student_id,
      project_id: newProject.id,
    })

    await adminSupabase.from('notifications').insert({
      user_id: member.student_id,
      type: 'classroom_project_added',
      title: 'New project in your classroom',
      body: `"${project.name}" has been added to your classroom.`,
      data: { project_id: newProject.id },
    })
  }

  return NextResponse.json({ success: true })
}
