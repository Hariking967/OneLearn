import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProjects, deleteProject } from '@/lib/db/projects'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectName, mainTopic, pathMode = 'ai', classroomId } = await req.json()
  if (!projectName || !mainTopic) {
    return NextResponse.json({ error: 'projectName and mainTopic required' }, { status: 400 })
  }

  const insert: Record<string, unknown> = {
    user_id: user.id,
    name: projectName,
    main_topic: mainTopic,
    path_mode: pathMode,
  }
  if (classroomId) insert.classroom_id = classroomId

  const { data, error } = await supabase.from('projects').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ projectId: data.id })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const projects = await getProjects(user.id)
  return NextResponse.json(projects)
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await deleteProject(id)
  return new NextResponse(null, { status: 204 })
}
