'use client'
import React, { useState, useEffect } from 'react'
import { Megaphone, ChevronDown, ChevronRight, Send, Loader2 } from 'lucide-react'

interface Reply {
  id: string
  post_id: string
  parent_reply_id: string | null
  author_name: string
  body: string
  created_at: string
  replies?: Reply[]
}

interface Post {
  id: string
  type: 'announcement' | 'discussion'
  title: string | null
  body: string
  author_name: string
  created_at: string
  replies: Reply[]
}

interface Props {
  classroomId: string
  isTeacher: boolean
  currentUserId: string
}

export function AnnouncementsTab({ classroomId, isTeacher, currentUserId }: Props) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [newText, setNewText] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [posting, setPosting] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [replyTo, setReplyTo] = useState<{ postId: string; parentReplyId?: string } | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  useEffect(() => { load() }, [classroomId])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/feed`)
      if (res.ok) setPosts(await res.json())
    } finally { setLoading(false) }
  }

  async function submitPost() {
    if (!newText.trim()) return
    setPosting(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'announcement', title: newTitle || null, text: newText })
      })
      if (res.ok) { setNewText(''); setNewTitle(''); await load() }
    } finally { setPosting(false) }
  }

  async function submitReply() {
    if (!replyText.trim() || !replyTo) return
    setReplying(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/feed/${replyTo.postId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyText, parent_reply_id: replyTo.parentReplyId ?? null })
      })
      if (res.ok) { setReplyText(''); setReplyTo(null); await load() }
    } finally { setReplying(false) }
  }

  function toggleExpand(id: string) {
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function renderReplies(replies: Reply[], postId: string, depth = 0): React.ReactNode {
    if (depth > 3) return null
    return replies.map(r => (
      <div key={r.id} style={{ marginLeft: depth * 18, borderLeft: '2px solid var(--line)', paddingLeft: 12, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{r.author_name}</span>
          <span style={{ fontSize: 10, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>{new Date(r.created_at).toLocaleString()}</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 4px' }}>{r.body}</p>
        {depth < 3 && (
          <button
            onClick={() => setReplyTo({ postId, parentReplyId: r.id })}
            style={{ fontSize: 11, color: 'var(--mute)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Reply
          </button>
        )}
        {r.replies?.length ? renderReplies(r.replies, postId, depth + 1) : null}
        {replyTo?.parentReplyId === r.id && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              onKeyDown={e => e.key === 'Enter' && submitReply()}
              style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--ink)' }}
            />
            <button onClick={submitReply} disabled={replying} style={{ padding: '6px 12px', borderRadius: 8, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)', cursor: 'pointer' }}>
              {replying ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={12} />}
            </button>
          </div>
        )}
      </div>
    ))
  }

  function PostCard({ post }: { post: Post }) {
    const isExpanded = expanded.has(post.id)
    return (
      <div style={{
        borderRadius: 12,
        background: 'linear-gradient(180deg, hsl(38 92% 50% / 0.06), hsl(38 92% 50% / 0.03))',
        border: '1px solid hsl(38 92% 50% / 0.2)',
        overflow: 'hidden',
        marginBottom: 10,
      }}>
        <div style={{ padding: '14px 16px' }}>
          {post.title && (
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>{post.title}</p>
          )}
          <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0, lineHeight: 1.6 }}>{post.body}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
              {post.author_name} · {new Date(post.created_at).toLocaleString()}
            </span>
            {post.replies.length > 0 && (
              <button
                onClick={() => toggleExpand(post.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--mute)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {post.replies.length} {post.replies.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
            <button
              onClick={() => { setReplyTo({ postId: post.id }); setExpanded(s => new Set([...s, post.id])) }}
              style={{ fontSize: 11, color: 'var(--mute)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Reply
            </button>
          </div>
        </div>
        {isExpanded && post.replies.length > 0 && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px' }}>
            {renderReplies(post.replies, post.id)}
          </div>
        )}
        {replyTo?.postId === post.id && !replyTo.parentReplyId && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px', display: 'flex', gap: 8 }}>
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              onKeyDown={e => e.key === 'Enter' && submitReply()}
              style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--ink)' }}
            />
            <button onClick={submitReply} disabled={replying} style={{ padding: '6px 12px', borderRadius: 8, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)', cursor: 'pointer' }}>
              {replying ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={12} />}
            </button>
          </div>
        )}
      </div>
    )
  }

  const announcements = posts.filter(p => p.type === 'announcement')

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Compose box — teachers post announcements only */}
      {isTeacher && (
        <div style={{ borderRadius: 12, background: 'linear-gradient(180deg, rgba(21,21,29,0.75), rgba(15,15,21,0.75))', border: '1px solid var(--line)', padding: 16, marginBottom: 20 }}>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Title (optional)"
            style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--ink)', marginBottom: 8, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="Write an announcement…"
              rows={3}
              style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--ink)', resize: 'vertical' }}
            />
            <button
              onClick={submitPost}
              disabled={posting || !newText.trim()}
              style={{ padding: '8px 14px', borderRadius: 8, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)', cursor: 'pointer', alignSelf: 'flex-end' }}
            >
              {posting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* Announcements list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Megaphone size={13} color="hsl(38 92% 65%)" />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'hsl(38 92% 65%)' }}>Announcements</span>
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--mute)' }} />
          </div>
        ) : announcements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--mute)', fontSize: 13, fontFamily: 'var(--font-mono)', border: '1px dashed var(--line)', borderRadius: 12 }}>
            No announcements yet.
          </div>
        ) : (
          announcements.map(p => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </div>
  )
}
