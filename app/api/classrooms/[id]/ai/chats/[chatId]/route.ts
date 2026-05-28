import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; chatId: string }> }
) {
  const { chatId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('classroom_ai_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
  return NextResponse.json(data ?? [])
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; chatId: string }> }
) {
  const { chatId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('classroom_ai_chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
