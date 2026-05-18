'use client'

import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Position,
  Handle,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useRouter } from 'next/navigation'
import type { Topic, TopicEdge } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

// Custom topic node
function TopicNode({ data }: { data: { label: string; description: string; status: Topic['status']; topicUrl: string } }) {
  const router = useRouter()
  const statusStyles: Record<Topic['status'], string> = {
    locked:   'border-gray-300 bg-gray-50 text-gray-400',
    unlocked: 'border-primary bg-primary/5 text-foreground hover:bg-primary/10 cursor-pointer',
    done:     'border-green-400 bg-green-50 text-green-800',
  }

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground/40" />
      <div
        className={cn(
          'px-4 py-3 rounded-xl border-2 shadow-sm min-w-[140px] max-w-[180px] transition-all',
          statusStyles[data.status]
        )}
        onClick={() => data.status !== 'locked' && router.push(data.topicUrl)}
        title={data.description}
      >
        <div className="text-xs font-semibold text-center leading-tight">{data.label}</div>
        {data.status === 'done' && (
          <div className="text-xs text-center mt-1 text-green-600">✓ Done</div>
        )}
        {data.status === 'locked' && (
          <div className="text-xs text-center mt-1">🔒 Locked</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground/40" />
    </>
  )
}

const nodeTypes = { topic: TopicNode }

interface Props {
  topics: Topic[]
  edges: TopicEdge[]
  projectId: string
}

export function TopicGraph({ topics, edges, projectId }: Props) {
  // Auto-layout: place nodes by topological depth
  const depthMap = useMemo(() => {
    const depth = new Map<string, number>()
    topics.forEach(t => depth.set(t.id, 0))
    // Simple BFS to assign levels
    let changed = true
    while (changed) {
      changed = false
      edges.forEach(e => {
        const parentDepth = depth.get(e.parent_id) ?? 0
        const childDepth = depth.get(e.child_id) ?? 0
        if (childDepth <= parentDepth) {
          depth.set(e.child_id, parentDepth + 1)
          changed = true
        }
      })
    }
    return depth
  }, [topics, edges])

  const levelGroups = useMemo(() => {
    const groups = new Map<number, Topic[]>()
    topics.forEach(t => {
      const level = depthMap.get(t.id) ?? 0
      if (!groups.has(level)) groups.set(level, [])
      groups.get(level)!.push(t)
    })
    return groups
  }, [topics, depthMap])

  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = []
    levelGroups.forEach((levelTopics, level) => {
      const count = levelTopics.length
      levelTopics.forEach((t, idx) => {
        const xSpacing = 220
        const ySpacing = 130
        const xOffset = -(((count - 1) * xSpacing) / 2)
        nodes.push({
          id: t.id,
          type: 'topic',
          position: { x: xOffset + idx * xSpacing, y: level * ySpacing },
          data: {
            label: t.name,
            description: t.description ?? '',
            status: t.status,
            topicUrl: `/project/${projectId}/topic/${t.id}`,
          },
        })
      })
    })
    return nodes
  }, [levelGroups, projectId])

  const initialEdges: Edge[] = useMemo(() =>
    edges.map(e => ({
      id: `${e.parent_id}-${e.child_id}`,
      source: e.parent_id,
      target: e.child_id,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      style: { stroke: '#6366f1', strokeWidth: 1.5 },
    })),
    [edges]
  )

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [rfEdges, , onEdgesChange] = useEdgesState(initialEdges)

  return (
    <div className="w-full h-full min-h-[500px] rounded-xl border overflow-hidden bg-muted/20">
      <ReactFlow
        nodes={nodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} color="#e5e7eb" />
        <Controls />
        <MiniMap nodeColor={node => {
          const status = (node.data as { status: Topic['status'] }).status
          return status === 'done' ? '#4ade80' : status === 'unlocked' ? '#818cf8' : '#d1d5db'
        }} />
      </ReactFlow>
    </div>
  )
}
