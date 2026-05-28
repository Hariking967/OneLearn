import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ping a friend in the classroom feed (sends them a notification)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { target_user_id, message } = await req.json()
  if (!target_user_id) return NextResponse.json({ error: 'target_user_id required' }, { status: 400 })

  // Verify target is in the same classroom
  const { data: member } = await supabase
    .from('classroom_members')
    .select('id')
    .eq('classroom_id', id)
    .eq('student_id', target_user_id)
    .single()

  const { data: classroom } = await supabase
    .from('classrooms')
    .select('teacher_id, name')
    .eq('id', id)
    .single()

  const isTeacher = classroom?.teacher_id === target_user_id
  if (!member && !isTeacher) {
    return NextResponse.json({ error: 'User not in this classroom' }, { status: 403 })
  }

  const { data: senderProfile } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const senderName = senderProfile?.display_name ?? user.email?.split('@')[0] ?? 'Someone'

  await supabase.from('notifications').insert({
    user_id: target_user_id,
    type: 'classroom_ping',
    title: `${senderName} pinged you`,
    body: message || `You were mentioned in ${classroom?.name ?? 'a classroom'}`,
    data: { classroom_id: id, from_user_id: user.id },
  })

  return NextResponse.json({ ok: true })
}
