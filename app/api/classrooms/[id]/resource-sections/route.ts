import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sections } = await supabase
    .from('classroom_resource_sections')
    .select('*, classroom_resource_files(*)')
    .eq('classroom_id', id)
    .order('order_index')
  return NextResponse.json(sections ?? [])
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: classroom } = await supabase
    .from('classrooms').select('id').eq('id', id).eq('teacher_id', user.id).single()
  if (!classroom) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, order_index } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const { data, error } = await supabase
    .from('classroom_resource_sections')
    .insert({ classroom_id: id, title: title.trim(), order_index: order_index ?? 0 })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const sectionId = searchParams.get('sectionId')
  if (!sectionId) return NextResponse.json({ error: 'sectionId required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: classroom } = await supabase
    .from('classrooms').select('id').eq('id', id).eq('teacher_id', user.id).single()
  if (!classroom) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabase
    .from('classroom_resource_sections')
    .delete()
    .eq('id', sectionId)
    .eq('classroom_id', id)
  return NextResponse.json({ success: true })
}
