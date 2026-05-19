'use client'

import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import type { UserTreeNode } from '@/lib/supabase/types'

interface Props {
  projectId: string
  onSave: (nodes: UserTreeNode[]) => void
  onClose: () => void
  initialNodes?: UserTreeNode[]
}

interface DraftNode {
  id: string
  name: string
  description: string
  parent_id: string | null
  position: number
}

function computeLevel(nodeId: string, nodes: DraftNode[]): number {
  const node = nodes.find(n => n.id === nodeId)
  if (!node || !node.parent_id) return 0
  return 1 + computeLevel(node.parent_id, nodes)
}

function getDescendantIds(nodeId: string, nodes: DraftNode[]): string[] {
  const children = nodes.filter(n => n.parent_id === nodeId)
  return children.flatMap(c => [c.id, ...getDescendantIds(c.id, nodes)])
}

function buildSortedList(nodes: DraftNode[]): DraftNode[] {
  const result: DraftNode[] = []
  function addChildren(parentId: string | null, depth: number) {
    const children = nodes
      .filter(n => n.parent_id === parentId)
      .sort((a, b) => a.position - b.position)
    for (const child of children) {
      result.push(child)
      addChildren(child.id, depth + 1)
    }
  }
  addChildren(null, 0)
  // append any orphaned nodes (shouldn't happen, but safety net)
  for (const n of nodes) {
    if (!result.find(r => r.id === n.id)) result.push(n)
  }
  return result
}

let _idCounter = 0
function genId() {
  return `draft-${Date.now()}-${++_idCounter}`
}

export function UserTreeBuilder({ projectId, onSave, onClose, initialNodes = [] }: Props) {
  const [nodes, setNodes] = useState<DraftNode[]>(() =>
    initialNodes.map((n, i) => ({
      id: n.id,
      name: n.name,
      description: n.description ?? '',
      parent_id: n.parent_id,
      position: n.position ?? i,
    }))
  )
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newParentId, setNewParentId] = useState<string>('none')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) return
    const parentId = newParentId === 'none' ? null : newParentId
    const siblingCount = nodes.filter(n => n.parent_id === parentId).length
    setNodes(prev => [
      ...prev,
      {
        id: genId(),
        name: trimmed,
        description: newDescription.trim(),
        parent_id: parentId,
        position: siblingCount,
      },
    ])
    setNewName('')
    setNewDescription('')
    setNewParentId('none')
  }

  function handleRemove(nodeId: string) {
    const toRemove = new Set([nodeId, ...getDescendantIds(nodeId, nodes)])
    setNodes(prev => prev.filter(n => !toRemove.has(n.id)))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const payload = nodes.map((n, i) => ({
        name: n.name,
        description: n.description || null,
        parent_id: n.parent_id,
        position: n.position ?? i,
      }))
      const res = await fetch(`/api/project/${projectId}/user-tree`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to save')
      }
      const saved: UserTreeNode[] = await res.json()
      onSave(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const sorted = buildSortedList(nodes)

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#1e1e2e',
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 560,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
            Build Your Learning Path
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--mute)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Add topic form */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--font-sans)' }}>
            Add a topic to your path
          </p>

          <input
            type="text"
            placeholder="Topic name *"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            style={{
              background: '#0f0f13',
              border: '1px solid var(--line)',
              borderRadius: 7,
              padding: '8px 12px',
              color: 'var(--ink)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />

          <textarea
            placeholder="Description (optional)"
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            rows={2}
            style={{
              background: '#0f0f13',
              border: '1px solid var(--line)',
              borderRadius: 7,
              padding: '8px 12px',
              color: 'var(--ink)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />

          <select
            value={newParentId}
            onChange={e => setNewParentId(e.target.value)}
            style={{
              background: '#0f0f13',
              border: '1px solid var(--line)',
              borderRadius: 7,
              padding: '8px 12px',
              color: newParentId === 'none' ? 'var(--mute)' : 'var(--ink)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <option value="none">None (root topic)</option>
            {sorted.map(n => {
              const level = computeLevel(n.id, nodes)
              const indent = '  '.repeat(level)
              return (
                <option key={n.id} value={n.id}>
                  {indent}{n.name}
                </option>
              )
            })}
          </select>

          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: newName.trim() ? '#6366f1' : 'rgba(99,102,241,0.3)',
              border: 'none',
              borderRadius: 7,
              padding: '8px 14px',
              color: newName.trim() ? '#fff' : 'rgba(255,255,255,0.4)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              cursor: newName.trim() ? 'pointer' : 'not-allowed',
              alignSelf: 'flex-start',
              transition: 'background 0.15s',
            }}
          >
            <Plus size={14} />
            Add Topic
          </button>
        </div>

        {/* Topic list */}
        {sorted.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: 12,
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--font-sans)' }}>
              Your learning path ({sorted.length} topic{sorted.length !== 1 ? 's' : ''})
            </p>
            {sorted.map(n => {
              const level = computeLevel(n.id, nodes)
              return (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    paddingLeft: level * 20,
                    paddingTop: 6,
                    paddingBottom: 6,
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <span
                    style={{
                      width: 6, height: 6,
                      borderRadius: '50%',
                      background: level === 0 ? '#6366f1' : 'var(--mute)',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: 'var(--ink)',
                      fontFamily: 'var(--font-sans)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {n.name}
                    {n.description && (
                      <span style={{ color: 'var(--mute)', fontSize: 11, marginLeft: 6 }}>
                        — {n.description.slice(0, 40)}{n.description.length > 40 ? '…' : ''}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => handleRemove(n.id)}
                    title="Remove (and its children)"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--mute)', padding: 4, borderRadius: 4,
                      display: 'flex', alignItems: 'center', flexShrink: 0,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <p style={{ margin: 0, fontSize: 12, color: '#ef4444', fontFamily: 'var(--font-sans)' }}>
            {error}
          </p>
        )}

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--line)',
              borderRadius: 7,
              padding: '8px 16px',
              color: 'var(--mute)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saving ? 'rgba(99,102,241,0.5)' : '#6366f1',
              border: 'none',
              borderRadius: 7,
              padding: '8px 20px',
              color: '#fff',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save Path'}
          </button>
        </div>
      </div>
    </div>
  )
}
