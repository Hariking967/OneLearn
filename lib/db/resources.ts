import { createClient } from '@/lib/supabase/server'
import type { Resource } from '@/lib/supabase/types'

export async function getResources(projectId: string): Promise<Resource[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Resource[]) ?? []
}

export async function createResource(
  projectId: string,
  label: string,
  type: Resource['type'],
  url?: string,
  storagePath?: string
): Promise<Resource> {
  const supabase = await createClient()
  const row = { project_id: projectId, label, type, url: url ?? null, storage_path: storagePath ?? null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.from('resources').insert(row as any).select().single()
  if (error) throw error
  return data as Resource
}

export async function deleteResource(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('resources').delete().eq('id', id)
  if (error) throw error
}
