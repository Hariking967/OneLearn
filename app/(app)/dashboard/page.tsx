import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@/lib/db/projects'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const projects = await getProjects(user!.id)
  return <DashboardClient initialProjects={projects} />
}
