'use client'

import { useState } from 'react'
import { Network, BookOpen, ChevronLeft, LayoutGrid, GitBranch } from 'lucide-react'
import Link from 'next/link'
import { TopicGraph } from '@/components/graph/TopicGraph'
import { ResourceList } from '@/components/resource/ResourceList'
import { AddResourceDialog } from '@/components/resource/AddResourceDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProjectSummaryDialog } from '@/components/ProjectSummaryDialog'
import { NotesSummaryDialog } from '@/components/NotesSummaryDialog'
import { SpacedReviewDialog } from '@/components/SpacedReviewDialog'
import { CollaborateDialog } from '@/components/CollaborateDialog'
import { ShareDialog } from '@/components/ShareDialog'
import { AssignToClassroomDialog } from '@/components/AssignToClassroomDialog'
import type { Project, Topic, TopicEdge, Resource, UserTreeNode } from '@/lib/supabase/types'
import { FileView } from '@/components/FileView'
import { UserTreeBuilder } from '@/components/UserTreeBuilder'

interface Props {
  project: Project
  topics: Topic[]
  edges: TopicEdge[]
  initialResources: Resource[]
  isTeacher?: boolean
  pathMode?: 'ai' | 'custom'
  userTreeNodes?: UserTreeNode[]
}

export function ProjectPageClient({
  project,
  topics,
  edges,
  initialResources,
  isTeacher = false,
  pathMode = 'ai',
  userTreeNodes: initialUserTreeNodes = [],
}: Props) {
  const [resources, setResources] = useState(initialResources)
  const [progressScore, setProgressScore] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'tree' | 'file'>('tree')
  const [showUserTreeBuilder, setShowUserTreeBuilder] = useState(false)
  const [userTreeNodes, setUserTreeNodes] = useState<UserTreeNode[]>(initialUserTreeNodes)

  const done = topics.filter(t => t.status === 'done').length
  const rawProgress = topics.length > 0 ? Math.round((done / topics.length) * 100) : 0
  const displayProgress = progressScore ?? rawProgress

  async function handleDeleteResource(id: string) {
    await fetch(`/api/resources?id=${id}`, { method: 'DELETE' })
    setResources(r => r.filter(res => res.id !== id))
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <header className="animate-fade-down border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-4 shrink-0">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-100 hover:bg-gray-800">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-100 truncate" style={{ fontFamily: 'var(--font-display)' }}>{project.name}</h1>
          {project.main_topic && (
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className="text-xs bg-violet-950 text-violet-400 border-violet-800 border">
                <BookOpen className="h-3 w-3 mr-1" />{project.main_topic}
              </Badge>
              <span className="text-xs text-gray-500">{done}/{topics.length} done</span>
            </div>
          )}
        </div>

        {topics.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 rounded-full transition-all duration-500"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-8 text-right">{displayProgress}%</span>
          </div>
        )}

        {isTeacher && <AssignToClassroomDialog projectId={project.id} />}
        <CollaborateDialog projectId={project.id} />
        <ShareDialog projectId={project.id} projectName={project.name} />
        <SpacedReviewDialog projectId={project.id} />

        {pathMode === 'custom' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUserTreeBuilder(true)}
            className="h-8 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 gap-1.5"
          >
            <GitBranch className="h-3.5 w-3.5" />
            Edit Path
          </Button>
        )}

        <ProjectSummaryDialog
          projectId={project.id}
          projectName={project.name}
          onProgressScore={setProgressScore}
        />

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {([
            { mode: 'tree' as const, Icon: Network, label: 'Graph' },
            { mode: 'file' as const, Icon: LayoutGrid, label: 'Cards' },
          ] as const).map(({ mode, Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                background: viewMode === mode ? 'oklch(0.42 0.18 295 / 0.15)' : 'none',
                border: 'none',
                color: viewMode === mode ? 'oklch(0.68 0.18 295)' : 'oklch(0.5 0 0)',
                fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <div className="flex items-center gap-2 mb-3">
            <Network className="h-4 w-4 text-gray-500" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Knowledge Graph</h2>
            <span className="text-xs text-gray-600">— click a node to open its chat</span>
          </div>

          {pathMode === 'custom' ? (
            userTreeNodes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-600 text-sm border border-dashed border-gray-800 rounded-xl">
                <span>No custom path defined yet.</span>
                <button
                  onClick={() => setShowUserTreeBuilder(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#6366f1', border: 'none', borderRadius: 7,
                    padding: '8px 16px', color: '#fff', fontSize: 13,
                    fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  }}
                >
                  <GitBranch size={14} />
                  Build Your Path
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {viewMode === 'tree' ? (
                  <CustomTreeView nodes={userTreeNodes} projectId={project.id} onEdit={() => setShowUserTreeBuilder(true)} />
                ) : (
                  <div style={{ height: '100%', overflowY: 'auto', padding: 4 }}>
                    <FileView
                      topics={userTreeNodes.map(n => ({
                        id: n.id,
                        project_id: project.id,
                        name: n.name,
                        description: n.description,
                        status: 'unlocked' as const,
                        created_at: n.created_at,
                      }))}
                      projectId={project.id}
                    />
                  </div>
                )}
              </div>
            )
          ) : topics.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm border border-dashed border-gray-800 rounded-xl">
              No topics yet.
            </div>
          ) : (
            <div className="flex-1">
              {viewMode === 'tree' ? (
                <TopicGraph topics={topics} edges={edges} projectId={project.id} />
              ) : (
                <div style={{ height: '100%', overflowY: 'auto', padding: 4 }}>
                  <FileView
                    topics={topics}
                    projectId={project.id}
                    resourceCount={resources.reduce<Record<string, number>>((acc, r) => {
                      if (r.suggested_topic_id) { acc[r.suggested_topic_id] = (acc[r.suggested_topic_id] ?? 0) + 1 }
                      return acc
                    }, {})}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="w-72 border-l border-gray-800 flex flex-col shrink-0 overflow-hidden bg-gray-900">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">Resources</h2>
            <div className="flex items-center gap-1 ml-auto">
              <NotesSummaryDialog projectId={project.id} />
              <AddResourceDialog projectId={project.id} onAdded={r => setResources(prev => [r, ...prev])} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ResourceList
              resources={resources}
              projectId={project.id}
              onDelete={handleDeleteResource}
            />
          </div>
        </aside>
      </div>

      {showUserTreeBuilder && (
        <UserTreeBuilder
          projectId={project.id}
          initialNodes={userTreeNodes}
          onSave={saved => setUserTreeNodes(saved)}
          onClose={() => setShowUserTreeBuilder(false)}
        />
      )}
    </div>
  )
}

// Simple indented tree view for custom paths
function CustomTreeView({
  nodes,
  projectId,
  onEdit,
}: {
  nodes: UserTreeNode[]
  projectId: string
  onEdit: () => void
}) {
  function computeLevel(nodeId: string): number {
    const node = nodes.find(n => n.id === nodeId)
    if (!node || !node.parent_id) return 0
    return 1 + computeLevel(node.parent_id)
  }

  function buildSorted(): UserTreeNode[] {
    const result: UserTreeNode[] = []
    function addChildren(parentId: string | null) {
      const children = nodes
        .filter(n => n.parent_id === parentId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      for (const child of children) {
        result.push(child)
        addChildren(child.id)
      }
    }
    addChildren(null)
    for (const n of nodes) {
      if (!result.find(r => r.id === n.id)) result.push(n)
    }
    return result
  }

  const sorted = buildSorted()

  return (
    <div style={{ padding: '8px 4px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingLeft: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--font-sans)' }}>
          Custom path — {nodes.length} topic{nodes.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onEdit}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: '1px solid var(--line)',
            borderRadius: 6, padding: '4px 10px',
            color: 'var(--mute)', fontSize: 11,
            fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}
        >
          <GitBranch size={11} />
          Edit Path
        </button>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sorted.map(n => {
          const level = computeLevel(n.id)
          return (
            <li
              key={n.id}
              style={{
                paddingLeft: level * 20 + 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: level === 0 ? 'oklch(0.68 0.18 295)' : 'var(--mute)',
              }} />
              <span style={{
                fontSize: 13,
                color: 'var(--ink)',
                fontFamily: 'var(--font-sans)',
                padding: '6px 0',
                lineHeight: 1.4,
              }}>
                {n.name}
                {n.description && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--mute)', marginTop: 1 }}>
                    {n.description.slice(0, 80)}{n.description.length > 80 ? '…' : ''}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
