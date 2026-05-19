import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: posts } = await supabase
    .from('feed_posts')
    .select('*')
    .eq('classroom_id', id)
    .order('created_at', { ascending: false })

  const postIds = (posts ?? []).map((p: any) => p.id)
  const { data: replies } = postIds.length
    ? await supabase.from('feed_replies').select('*').in('post_id', postIds).order('created_at', { ascending: true })
    : { data: [] }

  const authorIds = [...new Set([
    ...(posts ?? []).map((p: any) => p.author_id),
    ...(replies ?? []).map((r: any) => r.author_id)
  ].filter(Boolean))]

  let nameMap: Record<string, string> = {}
  if (authorIds.length) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, display_name')
      .in('id', authorIds)
    nameMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.display_name ?? p.id.slice(0, 8)]))
  }

  const replyMap: Record<string, any[]> = {}
  for (const r of (replies ?? [])) {
    if (!replyMap[r.post_id]) replyMap[r.post_id] = []
    replyMap[r.post_id].push({ ...r, author_name: nameMap[r.author_id] ?? 'User' })
  }

  const result = (posts ?? []).map((p: any) => ({
    ...p,
    author_name: nameMap[p.author_id] ?? 'User',
    replies: replyMap[p.id] ?? [],
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, title, text } = body
  if (!type || !text) return NextResponse.json({ error: 'type and text required' }, { status: 400 })

  if (type === 'announcement') {
    const { data: classroom } = await supabase.from('classrooms').select('teacher_id').eq('id', id).single()
    if (classroom?.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Only teacher can post announcements' }, { status: 403 })
    }
  }

  const { data, error } = await supabase
    .from('feed_posts')
    .insert({ classroom_id: id, author_id: user.id, type, title: title ?? null, body: text })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
