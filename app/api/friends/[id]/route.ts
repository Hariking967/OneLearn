import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string }> }

// Accept or decline a friend request
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = await req.json()
  if (!['accepted', 'declined'].includes(status)) {
    return NextResponse.json({ error: 'status must be accepted or declined' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('friendships')
    .update({ status })
    .eq('id', id)
    .eq('addressee_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (status === 'accepted') {
    await supabase.from('notifications').insert({
      user_id: data.requester_id,
      type: 'friend_accepted',
      title: 'Friend request accepted',
      body: 'Your friend request was accepted!',
      data: { friendship_id: id },
    })
  }

  return NextResponse.json(data)
}

// Unfriend / cancel request
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', id)
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
