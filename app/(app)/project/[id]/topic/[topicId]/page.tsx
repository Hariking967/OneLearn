import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { getTopic } from '@/lib/db/topics'
import { getNodeChatHistory } from '@/lib/chat/node-chat-service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import NodeChat from '@/components/NodeChat'

interface Props { params: Promise<{ id: string; topicId: string }> }

export default async function TopicPage({ params }: Props) {
  const { id, topicId } = await params
  const [topic, history] = await Promise.all([
    getTopic(topicId),
    getNodeChatHistory(topicId, 100),
  ])
  if (!topic) notFound()

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-4 shrink-0">
        <Link href={`/project/${id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-100 hover:bg-gray-800">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-100 truncate">{topic.name}</h1>
          {topic.description && (
            <p className="text-xs text-gray-500 truncate">{topic.description}</p>
          )}
        </div>
        <Badge
          className={
            topic.status === 'done'
              ? 'bg-green-950 text-green-400 border-green-800'
              : 'bg-violet-950 text-violet-400 border-violet-800'
          }
        >
          {topic.status}
        </Badge>
      </header>
      <div className="flex-1 overflow-hidden">
        <NodeChat topicId={topicId} topicName={topic.name} initialMessages={history.filter(m => m.role === 'user' || m.role === 'assistant') as any} />
      </div>
    </div>
  )
}
