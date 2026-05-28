import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const { id, sectionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: classroom } = await supabase
    .from('classrooms').select('id').eq('id', id).eq('teacher_id', user.id).single()
  if (!classroom) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, type, storage_path, url, size_bytes } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('classroom_resource_files')
    .insert({
      section_id: sectionId,
      classroom_id: id,
      name,
      type: type ?? 'txt',
      storage_path: storage_path ?? null,
      url: url ?? null,
      size_bytes: size_bytes ?? null,
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
