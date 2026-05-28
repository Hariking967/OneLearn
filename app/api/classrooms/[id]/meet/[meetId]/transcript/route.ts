import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string; meetId: string }> }

// Join meet (upsert participant)
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { meetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { display_name } = await req.json().catch(() => ({}))
  const { data: profile } = await supabase.from('user_profiles').select('display_name').eq('id', user.id).single()
  const name = display_name || profile?.display_name || user.email?.split('@')[0] || 'Participant'

  await supabase.from('meet_participants').upsert({ meet_id: meetId, user_id: user.id, display_name: name })
  return NextResponse.json({ ok: true })
}

// Add transcript segment
export async function POST(req: NextRequest, { params }: Ctx) {
  const { meetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text, speaker_name } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const { data: profile } = await supabase.from('user_profiles').select('display_name').eq('id', user.id).single()
  const name = speaker_name || profile?.display_name || user.email?.split('@')[0] || 'Participant'

  const { data, error } = await supabase
    .from('meet_transcript_segments')
    .insert({ meet_id: meetId, speaker_id: user.id, speaker_name: name, text: text.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
