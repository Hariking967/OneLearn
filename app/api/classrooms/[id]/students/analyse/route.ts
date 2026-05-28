import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: classroom } = await supabase
    .from('classrooms').select('id, name').eq('id', id).eq('teacher_id', user.id).single()
  if (!classroom) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: assignments } = await admin
    .from('classroom_assignments')
    .select('id, title, type')
    .eq('classroom_id', id)

  const { data: submissions } = await admin
    .from('assignment_submissions')
    .select('assignment_id, score, submitted_at')
    .eq('student_id', studentId)

  const subMap: Record<string, { score: number | null; submitted_at: string }> = {}
  for (const s of submissions ?? []) subMap[s.assignment_id] = s

  const summary = (assignments ?? []).map(a => {
    const sub = subMap[a.id]
    if (!sub) return `• ${a.title} (${a.type}): NOT submitted`
    const scoreStr = sub.score != null ? `score ${sub.score}%` : 'submitted, not yet scored'
    return `• ${a.title} (${a.type}): ${scoreStr}`
  }).join('\n')

  if (!summary) {
    return NextResponse.json({ analysis: 'No assignments in this classroom yet.' })
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `You are helping a teacher review a student's performance. Write a brief, constructive 2-3 sentence summary suitable for the teacher. Be specific about strengths and areas to improve based on the data.\n\nAssignment performance:\n${summary}`,
    }],
  })

  const analysis = (message.content[0] as { type: string; text: string }).text
  return NextResponse.json({ analysis })
}
