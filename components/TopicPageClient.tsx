'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle, RotateCcw, Loader2, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import NodeChat from '@/components/NodeChat'
import { ResourceList } from '@/components/resource/ResourceList'
import type { Topic, Resource } from '@/lib/supabase/types'

interface Props {
  topic: Topic
  projectId: string
  initialMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  sessionId?: string
  resources: Resource[]
}

export function TopicPageClient({ topic, projectId, initialMessages, sessionId, resources: initialResources }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<Topic['status']>(topic.status)
  const [updating, setUpdating] = useState(false)
  const [sessions, setSessions] = useState<Array<{ id: string; name: string }>>([])
  const [activeSession, setActiveSession] = useState<string | undefined>(sessionId)
  const [resources, setResources] = useState<Resource[]>(initialResources)
  const [panelOpen, setPanelOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem('resources-panel-open')
    return stored !== null ? stored === 'true' : window.innerWidth >= 1024
  })

  const fetchSessions = () => {
    fetch(`/api/topic/${topic.id}/sessions`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSessions(data) })
      .catch(() => {})
  }

  useEffect(() => {
    fetchSessions()
  }, [topic.id])

  const togglePanel = () => {
    const next = !panelOpen
    setPanelOpen(next)
    try { localStorage.setItem('resources-panel-open', String(next)) } catch {}
  }

  const handleDeleteResource = async (id: string) => {
    try {
      await fetch(`/api/projects/${projectId}/resources/${id}`, { method: 'DELETE' })
      setResources(prev => prev.filter(r => r.id !== id))
    } catch {
      // leave state unchanged on failure
    }
  }

  const toggle = async () => {
    const next = status === 'done' ? 'unlocked' : 'done'
    setUpdating(true)
    try {
      await fetch(`/api/topic/${topic.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      setStatus(next)
    } finally {
      setUpdating(false)
    }
  }

  const createSession = async (name?: string) => {
    try {
      const res = await fetch(`/api/topic/${topic.id}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(name ? { name } : {}),
      })
      if (!res.ok) return
      const s = await res.json()
      setSessions(prev => [...prev, s])
      setActiveSession(s.id)
      router.push(`?session=${s.id}`)
    } catch {}
  }

  const deleteSession = async (id: string) => {
    try {
      await fetch(`/api/topic/${topic.id}/sessions/${id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== id))
      if (activeSession === id) {
        setActiveSession(undefined)
        router.push(`/project/${projectId}/topic/${topic.id}`)
      }
    } catch {
      fetchSessions()
    }
  }

  const statusBadgeClass =
    status === 'done'
      ? 'bg-green-950 text-green-400 border-green-800 border'
      : status === 'unlocked'
      ? 'bg-violet-950 text-violet-400 border-violet-800 border'
      : 'bg-gray-800 text-gray-500 border-gray-700 border'

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <header className="animate-fade-down border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-4 shrink-0">
        <Link href={`/project/${projectId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-100 hover:bg-gray-800">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-100 truncate" style={{ fontFamily: 'var(--font-display)' }}>{topic.name}</h1>
          {topic.description && (
            <p className="text-xs text-gray-500 truncate">{topic.description}</p>
          )}
        </div>

        <Badge className={statusBadgeClass}>
          {status}
        </Badge>

        {status !== 'locked' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            disabled={updating}
            className={`text-xs gap-1.5 ${
              status === 'done'
                ? 'text-gray-400 hover:text-gray-200 border border-gray-700 hover:bg-gray-800'
                : 'text-green-400 hover:text-green-300 border border-green-800 hover:bg-green-950'
            }`}
          >
            {updating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : status === 'done' ? (
              <><RotateCcw className="w-3.5 h-3.5" /> Mark undone</>
            ) : (
              <><CheckCircle className="w-3.5 h-3.5" /> Mark done</>
            )}
          </Button>
        )}
      </header>

      {/* Session Strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 24px', borderBottom: '1px solid #1f2937',
        background: 'rgba(17,24,39,0.7)', overflowX: 'auto',
        flexShrink: 0,
      }}>
        {/* Default / Main session */}
        <button
          onClick={() => { setActiveSession(undefined); router.push(`/project/${projectId}/topic/${topic.id}`) }}
          style={{
            padding: '3px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', flexShrink: 0,
            background: !activeSession ? 'oklch(0.42 0.18 295 / 0.15)' : 'none',
            border: !activeSession ? '1px solid oklch(0.42 0.18 295 / 0.3)' : '1px solid #374151',
            color: !activeSession ? 'oklch(0.68 0.18 295)' : '#6b7280',
          }}
        >
          Main
        </button>

        {sessions.map(s => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '3px 4px 3px 10px', borderRadius: 7, flexShrink: 0,
            background: activeSession === s.id ? 'oklch(0.42 0.18 295 / 0.15)' : 'none',
            border: activeSession === s.id ? '1px solid oklch(0.42 0.18 295 / 0.3)' : '1px solid #374151',
          }}>
            <button
              onClick={() => { setActiveSession(s.id); router.push(`?session=${s.id}`) }}
              style={{ fontSize: 11, cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: activeSession === s.id ? 'oklch(0.68 0.18 295)' : '#6b7280' }}
            >
              {s.name}
            </button>
            <button
              onClick={() => { if (window.confirm('Delete this chat session? This cannot be undone.')) { deleteSession(s.id); } }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: '0 2px', display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#374151'}
            >
              <X size={10} />
            </button>
          </div>
        ))}

        <button
          onClick={() => {
            const name = window.prompt('Session name:', `Chat ${sessions.length + 2}`);
            if (name === null) return;
            createSession(name);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px',
            borderRadius: 7, background: 'none', border: '1px dashed #374151',
            color: '#4b5563', fontSize: 11, cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4b5563'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#374151' }}
        >
          <Plus size={10} /> New Chat
        </button>
      </div>

      {/* Chat + Resources split area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Chat area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <NodeChat
            key={activeSession ?? 'main'}
            topicId={topic.id}
            topicName={topic.name}
            initialMessages={initialMessages}
            sessionId={activeSession ?? undefined}
          />
        </div>

        {/* Panel toggle button */}
        <button
          onClick={togglePanel}
          title={panelOpen ? 'Hide resources' : 'Show resources'}
          style={{
            position: 'absolute',
            top: 12,
            right: panelOpen ? 332 : 8,
            zIndex: 10,
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            border: '1px solid #1f2937',
            background: 'rgba(17,24,39,0.8)',
            color: '#6b7280',
            cursor: 'pointer',
            transition: 'right 0.2s ease, color 0.15s, background 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            const btn = e.currentTarget as HTMLButtonElement
            btn.style.color = '#d1d5db'
            btn.style.background = 'rgba(55,65,81,0.9)'
          }}
          onMouseLeave={e => {
            const btn = e.currentTarget as HTMLButtonElement
            btn.style.color = '#6b7280'
            btn.style.background = 'rgba(17,24,39,0.8)'
          }}
        >
          {panelOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Resources panel */}
        {panelOpen && (
          <div style={{
            width: 320,
            borderLeft: '1px solid #1f2937',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'rgba(17,24,39,0.5)',
            flexShrink: 0,
          }}>
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid #1f2937',
              fontWeight: 600,
              fontSize: 12,
              color: '#6b7280',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              Resources
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              <ResourceList
                projectId={projectId}
                resources={resources}
                onDelete={handleDeleteResource}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
