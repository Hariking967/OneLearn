import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string; meetId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id, meetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [meetRes, segmentsRes, participantsRes] = await Promise.all([
    supabase.from('classroom_meets').select('*').eq('id', meetId).eq('classroom_id', id).single(),
    supabase.from('meet_transcript_segments').select('*').eq('meet_id', meetId).order('created_at', { ascending: true }),
    supabase.from('meet_participants').select('*').eq('meet_id', meetId),
  ])

  if (meetRes.error) return NextResponse.json({ error: 'Meet not found' }, { status: 404 })

  return NextResponse.json({
    meet: meetRes.data,
    segments: segmentsRes.data ?? [],
    participants: participantsRes.data ?? [],
  })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id, meetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('classroom_meets')
    .update(body)
    .eq('id', meetId)
    .eq('classroom_id', id)
    .eq('host_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
