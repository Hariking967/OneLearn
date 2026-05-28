'use client'
import { useState, useRef, useEffect } from 'react'
import { Brain, Send, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  classroomId: string
  currentUserId: string
}

export function OneAITab({ classroomId, currentUserId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? '' }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 0' }}>
        {messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '80px 0', gap: 12, color: 'var(--mute)',
          }}>
            <Brain size={32} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)', margin: 0 }}>
              Ask OneAI anything about this classroom.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 12,
          }}>
            <div style={{
              maxWidth: '75%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user'
                ? 'oklch(0.42 0.18 295 / 0.15)'
                : 'rgba(21,21,29,0.75)',
              border: msg.role === 'user'
                ? '1px solid oklch(0.42 0.18 295 / 0.3)'
                : '1px solid var(--line)',
              color: 'var(--ink)',
              fontSize: 13,
              lineHeight: 1.6,
              fontFamily: 'var(--font-sans)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: '14px 14px 14px 4px',
              background: 'rgba(21,21,29,0.75)',
              border: '1px solid var(--line)',
            }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--mute)' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid var(--line)',
        background: 'rgba(15,15,21,0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex', gap: 10, alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
          }}
          placeholder="Ask OneAI something..."
          rows={1}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'var(--bg-3)',
            border: '1px solid var(--line)',
            color: 'var(--ink)',
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: input.trim() && !loading ? 'oklch(0.42 0.18 295 / 0.2)' : 'var(--bg-3)',
            border: input.trim() && !loading ? '1px solid oklch(0.42 0.18 295 / 0.35)' : '1px solid var(--line)',
            color: input.trim() && !loading ? 'var(--purple-2)' : 'var(--mute)',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
