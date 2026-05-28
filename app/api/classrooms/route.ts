import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [createdRes, joinedRes] = await Promise.all([
    supabase
      .from('classrooms')
      .select('*, classroom_members(count), classroom_projects(count)')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('classroom_members')
      .select('classroom_id, classrooms(*)')
      .eq('student_id', user.id),
  ])

  const created = createdRes.data ?? []
  const joined = (joinedRes.data ?? []).map((m: any) => m.classrooms).filter(Boolean)

  return NextResponse.json({ created, joined })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description } = await request.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('classrooms')
    .insert({ teacher_id: user.id, name, description })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await supabase.from('classrooms').delete().eq('id', id).eq('teacher_id', user.id)
  return new NextResponse(null, { status: 204 })
}
