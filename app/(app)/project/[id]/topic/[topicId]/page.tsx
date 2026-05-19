import { notFound } from 'next/navigation'
import { getTopic } from '@/lib/db/topics'
import { getNodeChatHistory } from '@/lib/chat/node-chat-service'
import { TopicPageClient } from '@/components/TopicPageClient'

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

  const messages = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  return <TopicPageClient topic={topic} projectId={id} initialMessages={messages} sessionId={sessionId} />
}
