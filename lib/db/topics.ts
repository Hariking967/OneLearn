import { createClient } from '@/lib/supabase/server'
import type { Topic, TopicEdge } from '@/lib/supabase/types'

export async function getTopics(projectId: string): Promise<Topic[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as Topic[]) ?? []
}

export async function getTopic(id: string): Promise<Topic | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Topic
}

export async function bulkCreateTopics(
  projectId: string,
  topics: Array<{ name: string; description: string }>
): Promise<Topic[]> {
  const supabase = await createClient()
  const rows = topics.map(t => ({
    project_id: projectId,
    name: t.name,
    description: t.description,
    status: 'unlocked',
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.from('topics').insert(rows as any).select()
  if (error) throw error
  return (data as Topic[]) ?? []
}

export async function deleteTopic(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('topics').delete().eq('id', id)
  if (error) throw error
}

export async function updateTopicStatus(id: string, status: Topic['status']): Promise<void> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('topics').update({ status } as any).eq('id', id)
  if (error) throw error
}

export async function getTopicEdges(projectId: string): Promise<TopicEdge[]> {
  const topics = await getTopics(projectId)
  if (topics.length === 0) return []
  const ids = topics.map(t => t.id)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('topic_edges')
    .select('*')
    .in('parent_id', ids)
  if (error) throw error
  return (data as TopicEdge[]) ?? []
}

export async function replaceTopicEdges(topicIds: string[], edges: TopicEdge[]): Promise<void> {
  const supabase = await createClient()
  if (topicIds.length > 0) {
    const { error: delErr } = await supabase
      .from('topic_edges')
      .delete()
      .in('parent_id', topicIds)
    if (delErr) throw delErr
  }
  if (edges.length === 0) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('topic_edges').insert(edges as any)
  if (error) throw error
}
