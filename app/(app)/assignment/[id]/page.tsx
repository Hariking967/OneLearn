import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AssignmentPageClient } from './AssignmentPageClient'

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assignment } = await supabase
    .from('classroom_assignments').select('*').eq('id', id).single()
  if (!assignment) redirect('/dashboard')

  const { data: existingSubmission } = await supabase
    .from('assignment_submissions')
    .select('*').eq('assignment_id', id).eq('student_id', user.id).single()

  return (
    <AssignmentPageClient
      assignment={assignment}
      existingSubmission={existingSubmission ?? null}
    />
  )
}
