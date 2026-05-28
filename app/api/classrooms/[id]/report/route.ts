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

  const { data: classroom } = await supabase
    .from('classrooms').select('*').eq('id', id).eq('teacher_id', user.id).single()
  if (!classroom) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const [membersRes, assignmentsRes] = await Promise.all([
    supabase.from('classroom_members').select('student_id, joined_at').eq('classroom_id', id),
    supabase.from('classroom_assignments').select('id, title, type, deadline').eq('classroom_id', id).order('created_at'),
  ])
  const members = membersRes.data ?? []
  const assignments = assignmentsRes.data ?? []

  // Get all auth emails
  const { data: { users: authUsers } } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  const nameMap: Record<string, string> = {}
  for (const u of authUsers) {
    emailMap[u.id] = u.email ?? ''
    nameMap[u.id] = u.user_metadata?.full_name ?? u.user_metadata?.name ?? ''
  }

  // Get user_profiles for display names
  const studentIds = members.map(m => m.student_id)
  const { data: profiles } = studentIds.length > 0
    ? await supabase.from('user_profiles').select('id, display_name').in('id', studentIds)
    : { data: [] }
  const profileMap: Record<string, string> = {}
  for (const p of profiles ?? []) profileMap[p.id] = p.display_name ?? ''

  const report = []
  for (const member of members) {
    const { data: submissions } = await supabase
      .from('assignment_submissions')
      .select('assignment_id, score, ai_review, answers, submitted_at')
      .eq('student_id', member.student_id)
      .in('assignment_id', assignments.length > 0 ? assignments.map(a => a.id) : ['__none__'])

    const submissionMap: Record<string, any> = {}
    for (const s of submissions ?? []) submissionMap[s.assignment_id] = s

    const completedCount = submissions?.length ?? 0
    const scoredSubs = (submissions ?? []).filter(s => s.score !== null)
    const avgScore = scoredSubs.length > 0
      ? Math.round(scoredSubs.reduce((acc, s) => acc + (s.score ?? 0), 0) / scoredSubs.length)
      : null

    const displayName = profileMap[member.student_id]
      || nameMap[member.student_id]
      || emailMap[member.student_id]
      || member.student_id.slice(0, 8)

    report.push({
      student_id: member.student_id,
      display_name: displayName,
      email: emailMap[member.student_id] ?? '',
      joined_at: member.joined_at,
      assignments_total: assignments.length,
      assignments_completed: completedCount,
      avg_score: avgScore,
      submissions: submissionMap,
    })
  }

  return NextResponse.json({ classroom, assignments, report })
}
