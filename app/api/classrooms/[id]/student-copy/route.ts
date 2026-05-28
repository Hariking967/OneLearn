import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify teacher
  const { data: classroom } = await supabase
    .from('classrooms').select('id').eq('id', id).eq('teacher_id', user.id).single()
  if (!classroom) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId')
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

  // Get classroom project IDs for this classroom
  const { data: cpIds } = await supabase
    .from('classroom_projects').select('id').eq('classroom_id', id)

  if (!cpIds || cpIds.length === 0) return NextResponse.json({ project_id: null })

  // Find any one student copy in this classroom
  const { data: copy } = await supabase
    .from('student_project_copies')
    .select('project_id')
    .in('classroom_project_id', cpIds.map(c => c.id))
    .eq('student_id', studentId)
    .limit(1)
    .single()

  return NextResponse.json({ project_id: copy?.project_id ?? null })
}
