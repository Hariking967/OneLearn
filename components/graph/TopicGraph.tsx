'use client'

import { useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  Handle,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useRouter } from 'next/navigation'
import type { Topic, TopicEdge } from '@/lib/supabase/types'

const NODE_W = 172
const NODE_H = 64
const H_GAP = 32   // horizontal gap between siblings
const V_GAP = 90   // vertical gap between levels

function TopicNode({ data }: { data: { label: string; description: string; status: Topic['status']; topicUrl: string } }) {
  const router = useRouter()

  const accent =
    data.status === 'done'     ? { border: 'oklch(0.72 0.18 145)', bg: 'oklch(0.72 0.18 145 / 0.08)', text: 'oklch(0.85 0.12 145)' } :
    data.status === 'unlocked' ? { border: 'oklch(0.68 0.19 295)', bg: 'oklch(0.68 0.19 295 / 0.08)', text: 'var(--ink)' } :
                                 { border: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.02)', text: 'var(--mute)' }

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: 'var(--purple)', border: 'none', width: 6, height: 6 }}
      />
      <div
        onClick={() => data.status !== 'locked' && router.push(data.topicUrl)}
        title={data.description}
        style={{
          width: NODE_W, minHeight: NODE_H,
          padding: '10px 14px',
          borderRadius: 12,
          border: `1px solid ${accent.border}`,
          background: accent.bg,
          backdropFilter: 'blur(8px)',
          cursor: data.status === 'locked' ? 'default' : 'pointer',
          transition: 'all 0.18s',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
          boxShadow: data.status === 'unlocked' ? '0 0 18px oklch(0.68 0.19 295 / 0.15)' : 'none',
        }}
      >
        <div style={{
          fontSize: 12, fontWeight: 500,
          fontFamily: 'var(--font-sans)', color: accent.text,
          textAlign: 'center', lineHeight: 1.35,
        }}>
          {data.label}
        </div>
        {data.status === 'done' && (
          <div style={{ fontSize: 10, textAlign: 'center', color: 'oklch(0.72 0.18 145)', fontFamily: 'var(--font-mono)' }}>
            ✓ complete
          </div>
        )}
        {data.status === 'locked' && (
          <div style={{ fontSize: 10, textAlign: 'center', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
            🔒 locked
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: 'var(--purple)', border: 'none', width: 6, height: 6 }}
      />
    </>
  )
}

const nodeTypes = { topic: TopicNode }

interface Props {
  topics: Topic[]
  edges: TopicEdge[]
  projectId: string
}

// Reingold-Tilford-inspired tree layout:
// 1. Build adjacency (parent→children)
// 2. Post-order DFS to compute subtree widths
// 3. Pre-order DFS to assign x by centering children under parent
function buildTreeLayout(topics: Topic[], edges: TopicEdge[]): Map<string, { x: number; y: number }> {
  const children = new Map<string, string[]>()
  const parents = new Map<string, string[]>()
  topics.forEach(t => { children.set(t.id, []); parents.set(t.id, []) })
  edges.forEach(e => {
    children.get(e.parent_id)?.push(e.child_id)
    parents.get(e.child_id)?.push(e.parent_id)
  })

  // Assign depth via BFS from roots (nodes with no parents)
  const depth = new Map<string, number>()
  const roots = topics.filter(t => (parents.get(t.id)?.length ?? 0) === 0).map(t => t.id)
  if (roots.length === 0 && topics.length > 0) roots.push(topics[0].id) // fallback

  const queue = [...roots]
  roots.forEach(r => depth.set(r, 0))
  while (queue.length > 0) {
    const cur = queue.shift()!
    const d = depth.get(cur) ?? 0
    for (const child of children.get(cur) ?? []) {
      if (!depth.has(child) || depth.get(child)! < d + 1) {
        depth.set(child, d + 1)
        queue.push(child)
      }
    }
  }
  // Assign depth 0 to any orphaned nodes
  topics.forEach(t => { if (!depth.has(t.id)) depth.set(t.id, 0) })

  // Compute subtree leaf-count (used as width unit)
  const leafWidth = new Map<string, number>()
  function computeWidth(id: string, visited = new Set<string>()): number {
    if (visited.has(id)) return 1
    visited.add(id)
    const ch = children.get(id) ?? []
    if (ch.length === 0) { leafWidth.set(id, 1); return 1 }
    const w = ch.reduce((sum, c) => sum + computeWidth(c, visited), 0)
    leafWidth.set(id, w)
    return w
  }
  roots.forEach(r => computeWidth(r))
  topics.forEach(t => { if (!leafWidth.has(t.id)) leafWidth.set(t.id, 1) })

  const pos = new Map<string, { x: number; y: number }>()

  // Assign x positions by centering children under parent
  function assignX(id: string, leftEdge: number, visited = new Set<string>()) {
    if (visited.has(id)) return
    visited.add(id)
    const ch = children.get(id) ?? []
    const totalWidth = (leafWidth.get(id) ?? 1) * (NODE_W + H_GAP) - H_GAP
    const myX = leftEdge + totalWidth / 2 - NODE_W / 2

    const existing = pos.get(id)
    pos.set(id, { x: myX, y: (depth.get(id) ?? 0) * (NODE_H + V_GAP) })

    let childLeft = leftEdge
    for (const child of ch) {
      const cw = (leafWidth.get(child) ?? 1) * (NODE_W + H_GAP)
      assignX(child, childLeft, visited)
      childLeft += cw
    }
  }

  // Place each root tree side by side
  let rootOffset = 0
  for (const root of roots) {
    const treeWidth = (leafWidth.get(root) ?? 1) * (NODE_W + H_GAP)
    assignX(root, rootOffset, new Set())
    rootOffset += treeWidth + H_GAP * 2
  }

  // Fallback: place any unpositioned nodes (disconnected)
  let fallbackX = rootOffset
  topics.forEach(t => {
    if (!pos.has(t.id)) {
      pos.set(t.id, { x: fallbackX, y: (depth.get(t.id) ?? 0) * (NODE_H + V_GAP) })
      fallbackX += NODE_W + H_GAP
    }
  })

  return pos
}

export function TopicGraph({ topics, edges, projectId }: Props) {
  const posMap = useMemo(() => buildTreeLayout(topics, edges), [topics, edges])

  const initialNodes: Node[] = useMemo(() => topics.map(t => ({
    id: t.id,
    type: 'topic',
    position: posMap.get(t.id) ?? { x: 0, y: 0 },
    data: {
      label: t.name,
      description: t.description ?? '',
      status: t.status,
      topicUrl: `/project/${projectId}/topic/${t.id}`,
    },
  })), [topics, posMap, projectId])

  const initialEdges: Edge[] = useMemo(() => edges.map(e => ({
    id: `${e.parent_id}-${e.child_id}`,
    source: e.parent_id,
    target: e.child_id,
    animated: false,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, color: 'oklch(0.68 0.19 295)' },
    style: { stroke: 'oklch(0.68 0.19 295 / 0.5)', strokeWidth: 1.5 },
  })), [edges])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [rfEdges, , onEdgesChange] = useEdgesState(initialEdges)

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: 500,
      borderRadius: 14, overflow: 'hidden',
      border: '1px solid var(--line)',
      background: 'linear-gradient(180deg, rgba(15,15,21,0.8), rgba(10,10,15,0.9))',
    }}>
      <ReactFlow
        nodes={nodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="rgba(255,255,255,0.06)"
        />
        <Controls
          style={{
            background: 'var(--bg-2)', border: '1px solid var(--line)',
            borderRadius: 10, overflow: 'hidden',
          }}
        />
      </ReactFlow>
    </div>
  )
}
