import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; sectionId: string; fileId: string }> }
) {
  const { id, fileId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: classroom } = await supabase
    .from('classrooms').select('id').eq('id', id).eq('teacher_id', user.id).single()
  if (!classroom) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: file } = await supabase
    .from('classroom_resource_files')
    .select('storage_path')
    .eq('id', fileId)
    .single()

  if (file?.storage_path) {
    await admin.storage.from('classroom-resources').remove([file.storage_path])
  }

  await admin.from('classroom_resource_chunks').delete().eq('file_id', fileId)
  await supabase.from('classroom_resource_files').delete().eq('id', fileId)

  return NextResponse.json({ success: true })
}
