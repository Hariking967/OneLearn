import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const adminSupabase = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const { id, assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: assignment } = await supabase
    .from('classroom_assignments')
    .select('id, classroom_id, title, type, questions, created_by')
    .eq('id', assignmentId)
    .eq('classroom_id', id)
    .single()
  if (!assignment || assignment.created_by !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { data: submissions } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false })

  // Enrich with emails
  const { data: { users: authUsers } } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of authUsers) emailMap[u.id] = u.email ?? ''

  const enriched = (submissions ?? []).map(s => ({
    ...s,
    student_email: emailMap[s.student_id] ?? s.student_id.slice(0, 8),
  }))

  return NextResponse.json({ assignment, submissions: enriched })
}
