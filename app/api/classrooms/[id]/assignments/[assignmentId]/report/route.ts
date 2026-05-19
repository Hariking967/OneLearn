import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deepseekCompletion } from '@/lib/ai/deepseek-client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const { id: classroomId, assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: classroom } = await supabase.from('classrooms').select('teacher_id').eq('id', classroomId).single()
  if (classroom?.teacher_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: assignment }, { data: submissions }] = await Promise.all([
    supabase.from('classroom_assignments').select('*').eq('id', assignmentId).single(),
    supabase.from('assignment_submissions').select('*').eq('assignment_id', assignmentId),
  ])

  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const subs = submissions ?? []
  const scores = subs.map((s: any) => s.score).filter((s: any) => s != null) as number[]
  const avgScore = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null

  const questions = Array.isArray(assignment.questions) ? assignment.questions as any[] : []
  const questionStats = questions.map((q: any, qi: number) => {
    const correct = subs.filter((s: any) => {
      const ans = Array.isArray(s.answers) ? s.answers as any[] : []
      return ans[qi]?.selected === q.correct
    }).length
    return {
      question: q.question ?? `Q${qi + 1}`,
      correct,
      total: subs.length,
      pct: subs.length ? Math.round((correct / subs.length) * 100) : 0
    }
  })

  const hardest = questionStats.length ? questionStats.reduce((a, b) => a.pct < b.pct ? a : b) : null
  const easiest = questionStats.length ? questionStats.reduce((a, b) => a.pct > b.pct ? a : b) : null

  const distribution: Record<string, number> = { '0-39': 0, '40-69': 0, '70-89': 0, '90-100': 0 }
  for (const s of scores) {
    if (s < 40) distribution['0-39']++
    else if (s < 70) distribution['40-69']++
    else if (s < 90) distribution['70-89']++
    else distribution['90-100']++
  }

  let insight = ''
  if (scores.length > 0) {
    try {
      insight = await deepseekCompletion({
        messages: [{ role: 'user', content: `Assignment: "${assignment.title}". ${scores.length} submissions, avg ${avgScore}%.${hardest ? ` Hardest: "${hardest.question}" (${hardest.pct}% correct).` : ''} Give one sentence of teacher insight.` }],
        temperature: 0.4,
        maxTokens: 100,
      })
    } catch { insight = '' }
  }

  const studentIds = [...new Set(subs.map((s: any) => s.student_id).filter(Boolean))]
  let nameMap: Record<string, string> = {}
  if (studentIds.length) {
    const { data: profiles } = await supabase.from('user_profiles').select('id, display_name').in('id', studentIds)
    nameMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.display_name ?? p.id.slice(0, 8)]))
  }

  return NextResponse.json({
    assignment,
    submissions: subs.map((s: any) => ({
      id: s.id,
      student_name: nameMap[s.student_id] ?? s.student_id?.slice(0, 8) ?? 'Unknown',
      score: s.score,
      submitted_at: s.submitted_at
    })),
    avgScore, distribution, questionStats, hardest, easiest, insight,
  })
}
