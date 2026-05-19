import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const { postId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { body, parent_reply_id } = await req.json()
  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const { data, error } = await supabase
    .from('feed_replies')
    .insert({ post_id: postId, author_id: user.id, body, parent_reply_id: parent_reply_id ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
