import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const adminSupabase = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Teacher adds a resource to all student project copies in this classroom
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: classroom } = await supabase
    .from('classrooms').select('id').eq('id', id).eq('teacher_id', user.id).single()
  if (!classroom) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { projectId, type, url, label, storage_path } = await request.json()
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  // Get all student copies of this classroom project
  const { data: cp } = await supabase
    .from('classroom_projects').select('id').eq('classroom_id', id).eq('project_id', projectId).single()
  if (!cp) return NextResponse.json({ error: 'Project not in classroom' }, { status: 404 })

  const { data: copies } = await adminSupabase
    .from('student_project_copies').select('project_id').eq('classroom_project_id', cp.id)

  // Add resource to each student copy + teacher's project
  const projectIds = [projectId, ...(copies ?? []).map(c => c.project_id)]
  for (const pid of projectIds) {
    await adminSupabase.from('resources').insert({ project_id: pid, type, url, storage_path, label })
  }

  return NextResponse.json({ success: true })
}
