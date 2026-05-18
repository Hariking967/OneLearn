import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/lib/supabase/types'

export async function getProjects(userId: string): Promise<Project[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Project[]) ?? []
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Project
}

export async function createProject(
  userId: string,
  name: string,
  mainTopic: string,
  description?: string
): Promise<Project> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ user_id: userId, name, main_topic: mainTopic, description: description ?? null } as any)
    .select()
    .single()
  if (error) throw error
  return data as Project
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}
