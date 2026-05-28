import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('classroom_meets')
    .select('*')
    .eq('classroom_id', id)
    .order('started_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title } = await req.json().catch(() => ({}))

  // End any currently active meet first
  await supabase
    .from('classroom_meets')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('classroom_id', id)
    .eq('status', 'active')

  const { data, error } = await supabase
    .from('classroom_meets')
    .insert({ classroom_id: id, host_id: user.id, title: title || 'Class Meeting' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-join host as participant
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  await supabase.from('meet_participants').upsert({
    meet_id: data.id,
    user_id: user.id,
    display_name: profile?.display_name ?? user.email?.split('@')[0] ?? 'Host',
  })

  return NextResponse.json(data)
}
