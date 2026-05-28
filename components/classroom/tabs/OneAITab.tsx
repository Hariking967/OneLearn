'use client'
import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, Plus, Trash2, Send, Loader2, BookOpen,
  Layers, Brain, GitBranch, Upload, Check, X, ChevronRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Chat { id: string; title: string; created_at: string }
interface Message { id: string; role: 'user' | 'assistant'; content: string; created_at: string }
interface PersonalResource { id: string; name: string; type: string; ingested: boolean; created_at: string; storage_path: string | null }

type RightPanel = 'resources' | 'flashcards' | 'quiz' | 'tree'

interface Props { classroomId: string; currentUserId: string }

export function OneAITab({ classroomId, currentUserId }: Props) {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loadingChats, setLoadingChats] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [strictFileIds, setStrictFileIds] = useState<string[] | null>(null)

  const [rightPanel, setRightPanel] = useState<RightPanel>('resources')
  const [personalResources, setPersonalResources] = useState<PersonalResource[]>([])
  const [uploadingPersonal, setUploadingPersonal] = useState(false)
  const [ingestingPersonalId, setIngestingPersonalId] = useState<string | null>(null)

  const [flashcards, setFlashcards] = useState<{ front: string; back: string }[]>([])
  const [flashcardTopic, setFlashcardTopic] = useState('')
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false)
  const [flashcardIndex, setFlashcardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const [quizQuestions, setQuizQuestions] = useState<{ question: string; options: string[]; answer: string; explanation: string }[]>([])
  const [quizTopic, setQuizTopic] = useState('')
  const [generatingQuiz, setGeneratingQuiz] = useState(false)
  const [quizIndex, setQuizIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [quizResults, setQuizResults] = useState<boolean[]>([])

  const [tree, setTree] = useState<{ name: string; children?: any[] } | null>(null)
  const [treeTopic, setTreeTopic] = useState('')
  const [generatingTree, setGeneratingTree] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const personalFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadChats(); loadPersonalResources() }, [classroomId])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadChats() {
    setLoadingChats(true)
    const res = await fetch(`/api/classrooms/${classroomId}/ai/chats`)
    if (res.ok) {
      const data: Chat[] = await res.json()
      setChats(data)
      if (data.length > 0) await selectChat(data[0].id)
    }
    setLoadingChats(false)
  }

  async function selectChat(chatId: string) {
    setActiveChatId(chatId)
    setLoadingMessages(true)
    const res = await fetch(`/api/classrooms/${classroomId}/ai/chats/${chatId}`)
    if (res.ok) setMessages(await res.json())
    setLoadingMessages(false)
  }

  async function createChat() {
    const res = await fetch(`/api/classrooms/${classroomId}/ai/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Chat' }),
    })
    if (res.ok) {
      const chat: Chat = await res.json()
      setChats(p => [chat, ...p])
      setActiveChatId(chat.id)
      setMessages([])
    }
  }

  async function deleteChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/classrooms/${classroomId}/ai/chats/${chatId}`, { method: 'DELETE' })
    const remaining = chats.filter(c => c.id !== chatId)
    setChats(remaining)
    if (activeChatId === chatId) {
      if (remaining.length > 0) await selectChat(remaining[0].id)
      else { setActiveChatId(null); setMessages([]) }
    }
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || !activeChatId || streaming) return

    let effectiveStrictIds = strictFileIds
    if (text.startsWith('/strict_resource')) {
      effectiveStrictIds = personalResources.filter(r => r.ingested).map(r => r.id)
      setStrictFileIds(effectiveStrictIds)
      const rest = text.replace('/strict_resource', '').trim()
      if (!rest) { setInput(''); return }
    }

    setInput('')
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString() }
    setMessages(p => [...p, userMsg])
    setStreaming(true)

    const res = await fetch(`/api/classrooms/${classroomId}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: activeChatId, message: text, strictFileIds: effectiveStrictIds }),
    })

    if (!res.body) { setStreaming(false); return }

    const assistantId = `a-${Date.now()}`
    setMessages(p => [...p, { id: assistantId, role: 'assistant', content: '', created_at: new Date().toISOString() }])

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      full += decoder.decode(value)
      setMessages(p => p.map(m => m.id === assistantId ? { ...m, content: full } : m))
    }

    setStreaming(false)
    // Refresh chat list to pick up updated title
    const updated = await fetch(`/api/classrooms/${classroomId}/ai/chats`)
    if (updated.ok) setChats(await updated.json())
  }

  async function loadPersonalResources() {
    const res = await fetch(`/api/classrooms/${classroomId}/ai/personal-resources`)
    if (res.ok) setPersonalResources(await res.json())
  }

  async function uploadPersonalFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPersonal(true)
    const supabase = createClient()
    const path = `personal/${currentUserId}/${classroomId}/${Date.now()}-${file.name}`
    await supabase.storage.from('personal-resources').upload(path, file)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'txt'
    const type = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : 'txt'
    const res = await fetch(`/api/classrooms/${classroomId}/ai/personal-resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, type, storage_path: path, size_bytes: file.size }),
    })
    if (res.ok) {
      const newRes: PersonalResource = await res.json()
      setPersonalResources(p => [newRes, ...p])
      setUploadingPersonal(false)
      setIngestingPersonalId(newRes.id)
      await fetch(`/api/classrooms/${classroomId}/ai/personal-ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: newRes.id }),
      })
      setPersonalResources(p => p.map(r => r.id === newRes.id ? { ...r, ingested: true } : r))
      setIngestingPersonalId(null)
    } else {
      setUploadingPersonal(false)
    }
    e.target.value = ''
  }

  async function deletePersonalResource(id: string) {
    await fetch(`/api/classrooms/${classroomId}/ai/personal-resources?resourceId=${id}`, { method: 'DELETE' })
    setPersonalResources(p => p.filter(r => r.id !== id))
    if (strictFileIds?.includes(id)) setStrictFileIds(p => p ? p.filter(x => x !== id) : null)
  }

  async function generateFlashcards() {
    setGeneratingFlashcards(true)
    setFlashcardIndex(0)
    setFlipped(false)
    const res = await fetch(`/api/classrooms/${classroomId}/ai/flashcards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: flashcardTopic || undefined, count: 10, fileIds: strictFileIds }),
    })
    if (res.ok) { const { flashcards: fc } = await res.json(); setFlashcards(fc) }
    setGeneratingFlashcards(false)
  }

  async function generateQuiz() {
    setGeneratingQuiz(true)
    setQuizIndex(0)
    setSelectedAnswer(null)
    setQuizResults([])
    const res = await fetch(`/api/classrooms/${classroomId}/ai/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: quizTopic || undefined, count: 5, fileIds: strictFileIds }),
    })
    if (res.ok) { const { questions } = await res.json(); setQuizQuestions(questions) }
    setGeneratingQuiz(false)
  }

  async function generateTree() {
    setGeneratingTree(true)
    const res = await fetch(`/api/classrooms/${classroomId}/ai/tree`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: treeTopic || undefined, fileIds: strictFileIds }),
    })
    if (res.ok) { const { tree: t } = await res.json(); setTree(t) }
    setGeneratingTree(false)
  }

  function renderTree(node: { name: string; children?: any[] }, depth = 0): React.ReactNode {
    return (
      <div key={node.name + depth} style={{ marginLeft: depth * 14 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '3px 0',
          fontSize: 12,
          color: depth === 0 ? 'var(--purple-2)' : depth === 1 ? 'var(--ink)' : 'var(--ink-2)',
        }}>
          {node.children && node.children.length > 0
            ? <ChevronRight size={10} style={{ flexShrink: 0 }} />
            : <div style={{ width: 10 }} />}
          {node.name}
        </div>
        {node.children?.map((child: any, i: number) => (
          <div key={i}>{renderTree(child, depth + 1)}</div>
        ))}
      </div>
    )
  }

  const panelBtn: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
    fontSize: 11, fontFamily: 'var(--font-mono)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  }

  const actionBtn: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
    background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)',
    color: 'var(--purple-2)', fontSize: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-3)', border: '1px solid var(--line)',
    borderRadius: 8, padding: '7px 10px', fontSize: 12, color: 'var(--ink)',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 160px)', overflow: 'hidden' }}>

      {/* ── Left: chat sidebar ── */}
      <div style={{ width: 220, borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{
          padding: '8px 12px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ flex: 1, fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Chats</span>
          <button onClick={createChat} style={{ ...actionBtn, padding: '4px 8px' }}><Plus size={11} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {loadingChats
            ? <Loader2 size={14} style={{ margin: '20px auto', animation: 'spin 1s linear infinite', color: 'var(--mute)' }} />
            : chats.map(chat => (
              <div key={chat.id} onClick={() => selectChat(chat.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                background: activeChatId === chat.id ? 'oklch(0.42 0.18 295 / 0.15)' : 'none',
                border: `1px solid ${activeChatId === chat.id ? 'oklch(0.42 0.18 295 / 0.3)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}>
                <MessageSquare size={11} color={activeChatId === chat.id ? 'var(--purple-2)' : 'var(--mute)'} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: activeChatId === chat.id ? 'var(--ink)' : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {chat.title}
                </span>
                <button
                  onClick={e => deleteChat(chat.id, e)}
                  style={{ padding: 3, borderRadius: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'transparent', flexShrink: 0, transition: 'color 0.15s' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'hsl(0 85% 70%)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'transparent')}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── Center: chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Strict mode banner */}
        {strictFileIds && (
          <div style={{
            padding: '6px 16px', background: 'oklch(0.42 0.18 295 / 0.12)',
            borderBottom: '1px solid oklch(0.42 0.18 295 / 0.3)',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, color: 'var(--purple-2)', fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ flex: 1 }}>Strict resource mode — AI only uses your personal resources</span>
            <button onClick={() => setStrictFileIds(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: 2 }}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!activeChatId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--mute)', paddingTop: 80 }}>
              <Brain size={32} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)', margin: 0 }}>Select or create a chat to begin</p>
              <button onClick={createChat} style={actionBtn}><Plus size={12} /> New Chat</button>
            </div>
          ) : loadingMessages ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--mute)' }} />
            </div>
          ) : (
            <>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mute)', fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
                  Ask anything about your class resources.<br />
                  Type <code style={{ background: 'var(--bg-3)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>/strict_resource</code> to restrict AI to your personal resources only.
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    fontSize: 13, lineHeight: 1.65,
                    background: msg.role === 'user' ? 'oklch(0.42 0.18 295 / 0.18)' : 'rgba(255,255,255,0.04)',
                    border: msg.role === 'user' ? '1px solid oklch(0.42 0.18 295 / 0.3)' : '1px solid var(--line)',
                    color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {msg.content || (streaming && msg.role === 'assistant'
                      ? <span style={{ opacity: 0.4, fontFamily: 'var(--font-mono)', fontSize: 12 }}>…</span>
                      : null)}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input bar */}
        {activeChatId && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder={strictFileIds ? 'Ask about your personal resources…' : 'Ask anything… or /strict_resource to limit sources'}
              disabled={streaming}
              style={{
                flex: 1, background: 'var(--bg-3)', border: '1px solid var(--line)',
                borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--ink)',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              style={{
                width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
                background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)',
                color: 'var(--purple-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              {streaming ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            </button>
          </div>
        )}
      </div>

      {/* ── Right: tools panel ── */}
      <div style={{ width: 300, borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

        {/* Panel tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', padding: '6px 8px', gap: 2 }}>
          {([
            ['resources', BookOpen, 'Files'],
            ['flashcards', Layers, 'Cards'],
            ['quiz', Brain, 'Quiz'],
            ['tree', GitBranch, 'Tree'],
          ] as [RightPanel, any, string][]).map(([panel, Icon, label]) => (
            <button key={panel} onClick={() => setRightPanel(panel)} style={{
              ...panelBtn,
              flex: 1,
              background: rightPanel === panel ? 'oklch(0.42 0.18 295 / 0.15)' : 'none',
              border: rightPanel === panel ? '1px solid oklch(0.42 0.18 295 / 0.3)' : '1px solid transparent',
              color: rightPanel === panel ? 'var(--purple-2)' : 'var(--mute)',
            }}>
              <Icon size={10} />{label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Personal Resources */}
          {rightPanel === 'resources' && (
            <>
              <p style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', margin: 0, lineHeight: 1.6 }}>
                Your personal files — RAG&apos;d for OneAI only, not shared with the class.
              </p>
              <input ref={personalFileInputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }} onChange={uploadPersonalFile} />
              <button onClick={() => personalFileInputRef.current?.click()} disabled={uploadingPersonal} style={actionBtn}>
                {uploadingPersonal ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={11} />}
                Upload file
              </button>
              {personalResources.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '20px 0', margin: 0 }}>
                  No personal resources yet.
                </p>
              ) : (
                personalResources.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)',
                  }}>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </span>
                    {ingestingPersonalId === r.id
                      ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite', color: 'var(--mute)', flexShrink: 0 }} />
                      : r.ingested
                        ? <Check size={11} color="oklch(0.72 0.18 145)" style={{ flexShrink: 0 }} />
                        : null}
                    <button
                      onClick={() => deletePersonalResource(r.id)}
                      style={{ padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', flexShrink: 0 }}
                      onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'hsl(0 85% 70%)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)')}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))
              )}
              {personalResources.some(r => r.ingested) && (
                <button
                  onClick={() => setStrictFileIds(strictFileIds
                    ? null
                    : personalResources.filter(r => r.ingested).map(r => r.id)
                  )}
                  style={{
                    ...actionBtn,
                    background: strictFileIds ? 'oklch(0.42 0.18 295 / 0.25)' : 'none',
                    border: `1px solid ${strictFileIds ? 'oklch(0.42 0.18 295 / 0.5)' : 'var(--line)'}`,
                    color: strictFileIds ? 'var(--purple-2)' : 'var(--mute)',
                  }}
                >
                  {strictFileIds ? <X size={11} /> : <Check size={11} />}
                  {strictFileIds ? 'Exit strict mode' : 'Enable strict mode'}
                </button>
              )}
            </>
          )}

          {/* Flashcards */}
          {rightPanel === 'flashcards' && (
            <>
              <input value={flashcardTopic} onChange={e => setFlashcardTopic(e.target.value)} placeholder="Topic (optional)…" style={inputStyle} />
              <button onClick={generateFlashcards} disabled={generatingFlashcards} style={actionBtn}>
                {generatingFlashcards ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Layers size={11} />}
                Generate Flashcards
              </button>
              {flashcards.length > 0 && (
                <>
                  <div
                    onClick={() => setFlipped(f => !f)}
                    style={{
                      cursor: 'pointer', borderRadius: 10, padding: '20px 14px', textAlign: 'center',
                      minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: flipped ? 'oklch(0.42 0.18 295 / 0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${flipped ? 'oklch(0.42 0.18 295 / 0.3)' : 'var(--line)'}`,
                      fontSize: 13, color: 'var(--ink)', lineHeight: 1.5,
                    }}
                  >
                    {flipped ? flashcards[flashcardIndex].back : flashcards[flashcardIndex].front}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                      onClick={() => { setFlashcardIndex(i => Math.max(0, i - 1)); setFlipped(false) }}
                      disabled={flashcardIndex === 0}
                      style={{ ...actionBtn, padding: '5px 12px' }}
                    >←</button>
                    <span style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
                      {flashcardIndex + 1} / {flashcards.length}
                    </span>
                    <button
                      onClick={() => { setFlashcardIndex(i => Math.min(flashcards.length - 1, i + 1)); setFlipped(false) }}
                      disabled={flashcardIndex === flashcards.length - 1}
                      style={{ ...actionBtn, padding: '5px 12px' }}
                    >→</button>
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--mute)', textAlign: 'center', fontFamily: 'var(--font-mono)', margin: 0 }}>
                    Tap card to flip
                  </p>
                </>
              )}
            </>
          )}

          {/* Quiz */}
          {rightPanel === 'quiz' && (
            <>
              <input value={quizTopic} onChange={e => setQuizTopic(e.target.value)} placeholder="Topic (optional)…" style={inputStyle} />
              <button onClick={generateQuiz} disabled={generatingQuiz} style={actionBtn}>
                {generatingQuiz ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={11} />}
                Generate Quiz
              </button>

              {quizQuestions.length > 0 && quizIndex < quizQuestions.length && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 10, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
                    {quizIndex + 1}/{quizQuestions.length} · Score: {quizResults.filter(Boolean).length}/{quizResults.length}
                  </span>
                  <p style={{ fontSize: 12, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>
                    {quizQuestions[quizIndex].question}
                  </p>
                  {quizQuestions[quizIndex].options.map(opt => {
                    const isSelected = selectedAnswer === opt
                    const isCorrect = opt === quizQuestions[quizIndex].answer
                    const revealed = selectedAnswer !== null
                    return (
                      <button key={opt} disabled={revealed}
                        onClick={() => { setSelectedAnswer(opt); setQuizResults(r => [...r, opt === quizQuestions[quizIndex].answer]) }}
                        style={{
                          width: '100%', padding: '7px 10px', borderRadius: 8,
                          cursor: revealed ? 'default' : 'pointer', textAlign: 'left', fontSize: 12, lineHeight: 1.4,
                          background: revealed ? (isCorrect ? 'oklch(0.72 0.18 145 / 0.12)' : isSelected ? 'hsl(0 85% 60% / 0.12)' : 'none') : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${revealed ? (isCorrect ? 'oklch(0.72 0.18 145 / 0.3)' : isSelected ? 'hsl(0 85% 60% / 0.3)' : 'var(--line)') : 'var(--line)'}`,
                          color: revealed ? (isCorrect ? 'oklch(0.72 0.18 145)' : isSelected ? 'hsl(0 85% 70%)' : 'var(--mute)') : 'var(--ink)',
                        }}
                      >{opt}</button>
                    )
                  })}
                  {selectedAnswer && (
                    <>
                      <p style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', margin: 0, lineHeight: 1.5 }}>
                        {quizQuestions[quizIndex].explanation}
                      </p>
                      <button onClick={() => { setQuizIndex(i => i + 1); setSelectedAnswer(null) }} style={actionBtn}>
                        {quizIndex < quizQuestions.length - 1 ? 'Next →' : 'Finish'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {quizQuestions.length > 0 && quizIndex >= quizQuestions.length && (
                <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 20, fontFamily: 'var(--font-serif)', color: 'var(--ink)', margin: 0 }}>
                    {quizResults.filter(Boolean).length}/{quizResults.length}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--font-mono)', margin: 0 }}>Quiz complete</p>
                  <button onClick={() => { setQuizIndex(0); setSelectedAnswer(null); setQuizResults([]); setQuizQuestions([]) }} style={actionBtn}>
                    Try again
                  </button>
                </div>
              )}
            </>
          )}

          {/* Learning Tree */}
          {rightPanel === 'tree' && (
            <>
              <input value={treeTopic} onChange={e => setTreeTopic(e.target.value)} placeholder="Main topic to map…" style={inputStyle} />
              <button onClick={generateTree} disabled={generatingTree} style={actionBtn}>
                {generatingTree ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <GitBranch size={11} />}
                Generate Tree
              </button>
              {tree && (
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'rgba(255,255,255,0.02)', maxHeight: 380, overflowY: 'auto' }}>
                  {renderTree(tree)}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
