'use client'

import { useState } from 'react'
import { Network, BookOpen, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { TopicGraph } from '@/components/graph/TopicGraph'
import { ResourceList } from '@/components/resource/ResourceList'
import { AddResourceDialog } from '@/components/resource/AddResourceDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Project, Topic, TopicEdge, Resource } from '@/lib/supabase/types'

interface Props {
  project: Project
  topics: Topic[]
  edges: TopicEdge[]
  initialResources: Resource[]
}

export function ProjectPageClient({ project, topics, edges, initialResources }: Props) {
  const [resources, setResources] = useState(initialResources)

  const done = topics.filter(t => t.status === 'done').length
  const progress = topics.length > 0 ? Math.round((done / topics.length) * 100) : 0

  async function handleDeleteResource(id: string) {
    await fetch(`/api/resources?id=${id}`, { method: 'DELETE' })
    setResources(r => r.filter(res => res.id !== id))
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center gap-4 shrink-0">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{project.name}</h1>
          {project.main_topic && (
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-xs">
                <BookOpen className="h-3 w-3 mr-1" />
                {project.main_topic}
              </Badge>
              <span className="text-xs text-muted-foreground">{done}/{topics.length} topics done · {progress}%</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main: Knowledge Graph */}
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <div className="flex items-center gap-2 mb-3">
            <Network className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Knowledge Graph</h2>
            <span className="text-xs text-muted-foreground">— click an unlocked topic to open its chat</span>
          </div>

          {topics.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-xl">
              No topics generated yet.
            </div>
          ) : (
            <div className="flex-1">
              <TopicGraph topics={topics} edges={edges} projectId={project.id} />
            </div>
          )}
        </div>

        {/* Sidebar: Resources */}
        <aside className="w-80 border-l flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold">Resources</h2>
            <AddResourceDialog projectId={project.id} onAdded={r => setResources(prev => [r, ...prev])} />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ResourceList resources={resources} onDelete={handleDeleteResource} />
          </div>
        </aside>
      </div>
    </div>
  )
}
