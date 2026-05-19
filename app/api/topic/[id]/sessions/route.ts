import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: topicId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('topic_id', topicId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: topicId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('topic_id', topicId)
    .eq('user_id', user.id)

  const name = body.name || `Chat ${(existing?.length ?? 0) + 1}`

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ topic_id: topicId, user_id: user.id, name })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
