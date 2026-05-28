import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with profiles
  const friendIds = (data ?? []).map(f =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  )

  let profiles: Record<string, any> = {}
  if (friendIds.length) {
    const { data: ps } = await supabase
      .from('user_profiles')
      .select('id, display_name')
      .in('id', friendIds)
    profiles = Object.fromEntries((ps ?? []).map(p => [p.id, p]))
  }

  const enriched = (data ?? []).map(f => {
    const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id
    return {
      ...f,
      friend_id: friendId,
      friend_profile: profiles[friendId] ?? null,
      is_requester: f.requester_id === user.id,
    }
  })

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { addressee_id } = await req.json()
  if (!addressee_id) return NextResponse.json({ error: 'addressee_id required' }, { status: 400 })
  if (addressee_id === user.id) return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })

  // Check for existing friendship (either direction)
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${addressee_id}),and(requester_id.eq.${addressee_id},addressee_id.eq.${user.id})`)
    .single()

  if (existing) return NextResponse.json({ error: 'Request already exists', existing }, { status: 409 })

  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify addressee
  await supabase.from('notifications').insert({
    user_id: addressee_id,
    type: 'friend_request',
    title: 'New friend request',
    body: 'Someone sent you a friend request',
    data: { friendship_id: data.id, from: user.id },
  })

  return NextResponse.json(data, { status: 201 })
}
