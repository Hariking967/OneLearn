import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const adminSupabase = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, email } = await request.json()
  if (!projectId || !email) return NextResponse.json({ error: 'projectId and email required' }, { status: 400 })

  // Verify caller owns the project
  const { data: project } = await supabase
    .from('projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Look up target user by email
  const { data: { users } } = await adminSupabase.auth.admin.listUsers()
  const targetUser = users.find(u => u.email === email)
  if (!targetUser) return NextResponse.json({ error: 'No user with that email found' }, { status: 404 })
  if (targetUser.id === user.id) return NextResponse.json({ error: 'Cannot share with yourself' }, { status: 400 })

  // Deep copy: create new project for target user
  const { data: newProject, error: projErr } = await adminSupabase
    .from('projects')
    .insert({ user_id: targetUser.id, name: project.name, description: project.description, main_topic: project.main_topic })
    .select().single()
  if (projErr || !newProject) return NextResponse.json({ error: 'Failed to create project copy' }, { status: 500 })

  // Copy topics
  const { data: topics } = await supabase.from('topics').select('*').eq('project_id', projectId)
  const topicIdMap: Record<string, string> = {}
  if (topics && topics.length > 0) {
    for (const topic of topics) {
      const { data: newTopic } = await adminSupabase
        .from('topics')
        .insert({ project_id: newProject.id, name: topic.name, description: topic.description, status: 'unlocked' })
        .select().single()
      if (newTopic) topicIdMap[topic.id] = newTopic.id
    }

    // Copy edges with new topic IDs
    const { data: edges } = await supabase.from('topic_edges').select('*').in('parent_id', Object.keys(topicIdMap))
    if (edges && edges.length > 0) {
      const newEdges = edges
        .filter(e => topicIdMap[e.parent_id] && topicIdMap[e.child_id])
        .map(e => ({ parent_id: topicIdMap[e.parent_id], child_id: topicIdMap[e.child_id] }))
      if (newEdges.length > 0) await adminSupabase.from('topic_edges').insert(newEdges)
    }
  }

  // Copy resources metadata (not re-uploading files)
  const { data: resources } = await supabase.from('resources').select('*').eq('project_id', projectId)
  if (resources && resources.length > 0) {
    await adminSupabase.from('resources').insert(
      resources.map(r => ({
        project_id: newProject.id,
        type: r.type,
        url: r.url,
        storage_path: r.storage_path,
        label: r.label,
      }))
    )
  }

  // Notify recipient
  await adminSupabase.from('notifications').insert({
    user_id: targetUser.id,
    type: 'project_shared',
    title: 'A project was shared with you',
    body: `"${project.name}" has been shared with you as an independent copy.`,
    data: { project_id: newProject.id },
  })

  return NextResponse.json({ success: true, projectId: newProject.id })
}
