import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProjects, deleteProject } from '@/lib/db/projects'

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
