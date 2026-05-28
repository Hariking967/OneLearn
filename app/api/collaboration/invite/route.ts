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
    .from('projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Look up invited user by email
  const { data: { users }, error: lookupError } = await adminSupabase.auth.admin.listUsers()
  if (lookupError) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  const invitedUser = users.find(u => u.email === email)
  if (!invitedUser) return NextResponse.json({ error: 'No user with that email found' }, { status: 404 })
  if (invitedUser.id === user.id) return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 })

  const { error } = await supabase
    .from('project_collaborators')
    .upsert({ project_id: projectId, user_id: invitedUser.id, invited_by: user.id, status: 'accepted' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify invited user
  await supabase.from('notifications').insert({
    user_id: invitedUser.id,
    type: 'collaboration_invite',
    title: 'You were added to a project',
    body: `You now have collaborative access to a shared project.`,
    data: { project_id: projectId },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  const userId = searchParams.get('userId')
  if (!projectId || !userId) return NextResponse.json({ error: 'params required' }, { status: 400 })

  await supabase.from('project_collaborators')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  return new NextResponse(null, { status: 204 })
}
