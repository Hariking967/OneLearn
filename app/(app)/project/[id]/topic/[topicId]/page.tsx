import { notFound } from 'next/navigation'
import { getTopic } from '@/lib/db/topics'
import { getNodeChatHistory } from '@/lib/chat/node-chat-service'
import { createClient } from '@/lib/supabase/server'
import { TopicPageClient } from '@/components/TopicPageClient'
import type { Resource } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ id: string; topicId: string }>
  searchParams: Promise<{ session?: string }>
}

export default async function TopicPage({ params, searchParams }: Props) {
  const { id, topicId } = await params
  const { session: sessionId } = await searchParams

  const [topic, history] = await Promise.all([
    getTopic(topicId),
    getNodeChatHistory(topicId, 100, sessionId),
  ])
  if (!topic) notFound()

  const supabase = await createClient()
  const { data: resources } = await supabase
    .from('resources')
    .select('*')
    .eq('project_id', topic.project_id)
    .order('created_at', { ascending: false })

  const messages = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  return (
    <TopicPageClient
      topic={topic}
      projectId={id}
      initialMessages={messages}
      sessionId={sessionId}
      resources={(resources ?? []) as Resource[]}
    />
  )
}
