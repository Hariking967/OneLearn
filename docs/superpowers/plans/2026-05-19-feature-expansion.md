# OneLearn Feature Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Feed, multi-chat sessions, file view, user tree builder, project-level test generation, classroom restructure, assignment AI generation, auto-correct, per-test reports, collapsible resources panel, and fix RAG auto-indexing.

**Architecture:** Three sequential tracks — Track 1 (DB + RAG) must land first; Tracks 2 and 3 can run after. All UI follows existing dark theme (`#0f0f13` bg, `var(--purple)` accent, `var(--font-serif/mono/sans)`).

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + pgvector), Anthropic/DeepSeek via OpenRouter, Tailwind + custom CSS vars, shadcn/ui

---

## Task 1: DB Migration + Types

**Files:**
- Create: `migrations/005_feature_expansion.sql`
- Modify: `lib/supabase/types.ts`

### Steps

- [ ] Create `migrations/005_feature_expansion.sql`:

```sql
-- Multiple isolated chat sessions per topic
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL DEFAULT 'Chat 1',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL;

-- Feed
CREATE TABLE IF NOT EXISTS feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid REFERENCES classrooms(id) ON DELETE CASCADE,
  author_id uuid,
  type text NOT NULL CHECK (type IN ('announcement','discussion')),
  title text,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS feed_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES feed_posts(id) ON DELETE CASCADE,
  parent_reply_id uuid REFERENCES feed_replies(id) ON DELETE CASCADE,
  author_id uuid,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Assignment enhancements
ALTER TABLE classroom_assignments ADD COLUMN IF NOT EXISTS auto_correct boolean DEFAULT true;
ALTER TABLE classroom_assignments ADD COLUMN IF NOT EXISTS auto_correct_enabled boolean DEFAULT true;

-- Resource ingest status
ALTER TABLE resources ADD COLUMN IF NOT EXISTS ingest_status text DEFAULT 'pending' CHECK (ingest_status IN ('pending','indexing','done','error'));
ALTER TABLE resources ADD COLUMN IF NOT EXISTS suggested_topic_id uuid REFERENCES topics(id);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS topic_confirmed boolean DEFAULT false;

-- User-defined learning path
ALTER TABLE projects ADD COLUMN IF NOT EXISTS path_mode text DEFAULT 'ai' CHECK (path_mode IN ('ai','custom'));
CREATE TABLE IF NOT EXISTS user_tree_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL,
  description text,
  parent_id uuid REFERENCES user_tree_nodes(id),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

- [ ] Apply migration via Supabase MCP (`mcp__supabase__apply_migration`) or note it must be run manually.

- [ ] Add new interfaces to `lib/supabase/types.ts` after the existing `Notification` interface:

```typescript
export interface ChatSession {
  id: string
  topic_id: string
  user_id: string | null
  name: string
  created_at: string
}

export interface FeedPost {
  id: string
  classroom_id: string
  author_id: string | null
  type: 'announcement' | 'discussion'
  title: string | null
  body: string
  created_at: string
  author_email?: string
}

export interface FeedReply {
  id: string
  post_id: string
  parent_reply_id: string | null
  author_id: string | null
  body: string
  created_at: string
  author_email?: string
  replies?: FeedReply[]
}

export interface UserTreeNode {
  id: string
  project_id: string
  user_id: string | null
  name: string
  description: string | null
  parent_id: string | null
  position: number
  created_at: string
}
```

- [ ] Add `path_mode`, `auto_correct`, `ingest_status`, `suggested_topic_id`, `topic_confirmed` to existing interfaces:

```typescript
// In Project interface, add:
path_mode?: 'ai' | 'custom'

// In Resource interface, add:
ingest_status?: 'pending' | 'indexing' | 'done' | 'error'
suggested_topic_id?: string | null
topic_confirmed?: boolean

// In ClassroomAssignment interface, add:
auto_correct?: boolean
auto_correct_enabled?: boolean
```

- [ ] Commit: `git add migrations/005_feature_expansion.sql lib/supabase/types.ts && git commit -m "feat: DB migration and types for feature expansion"`

---

## Task 2: RAG Fix — Auto-Index on Upload

**Files:**
- Modify: `app/api/project/[id]/resources/upload/route.ts`
- Modify: `lib/ingest/pipeline.ts` (fix bucket name)
- Modify: `components/resource/ResourceList.tsx` (remove manual index button, add status badge)

### Root causes found in code:
1. Upload route sets `ingested_at` immediately but never calls `ingestResource`
2. `pipeline.ts` downloads from bucket `"resources"` but upload uses `"learning-resources"`
3. `retriever.ts` / `embedder.ts` guard on `OPENAI_API_KEY` — silently return "" if not set; must add OPENAI_API_KEY to `.env.local`
4. `ResourceList` shows manual "Index" button — remove it

### Steps

- [ ] Fix bucket name in `lib/ingest/pipeline.ts` line 33 — change `"resources"` to `"learning-resources"`:

```typescript
const { data, error } = await supabase.storage
  .from("learning-resources")   // was: "resources"
  .download(resource.storage_path);
```

- [ ] Fix `app/api/project/[id]/resources/upload/route.ts` — remove premature `ingested_at`, set `ingest_status: 'pending'`, then trigger ingest in background. Replace the `.insert({...})` block and response:

```typescript
const { data: resource, error: dbError } = await supabase
  .from("resources")
  .insert({
    project_id: projectId,
    type: file.type.includes("pdf") ? "pdf"
      : file.type.includes("word") || file.type.includes("document") ? "docx"
      : "text",
    url: urlData.publicUrl,
    storage_path: storagePath,
    ingest_status: "pending",
  })
  .select()
  .single();

if (dbError) throw dbError;

// Fire-and-forget background ingest
setImmediate(async () => {
  try {
    await supabase.from("resources").update({ ingest_status: "indexing" }).eq("id", resource.id);
    const { ingestResource } = await import("@/lib/ingest/pipeline");
    await ingestResource(resource);
    await supabase.from("resources").update({ ingest_status: "done", ingested_at: new Date().toISOString() }).eq("id", resource.id);
  } catch (e) {
    console.error("[Auto-ingest failed]", e);
    await supabase.from("resources").update({ ingest_status: "error" }).eq("id", resource.id);
  }
});

return NextResponse.json<UploadResponse>({
  success: true,
  resource: { id: resource.id, url: resource.url, storage_path: storagePath },
  message: `Successfully uploaded "${file.name}" — indexing in background`,
});
```

- [ ] Also handle YouTube/URL/note resources in the existing AddResourceDialog route (check `app/api/project/[id]/resources/route.ts` or similar, apply same pattern: set `ingest_status: 'indexing'`, fire-and-forget ingest).

- [ ] Replace `ResourceList.tsx` — remove `IndexButton` component entirely; add status badge inline:

```typescript
// Remove the entire IndexButton component and its import of RefreshCw
// Replace <IndexButton resource={r} projectId={projectId} onIndexed={onIndexed} />
// with this inline status badge:
{r.ingest_status === 'indexing' && (
  <span className="flex items-center gap-1 text-xs text-yellow-500 shrink-0">
    <Loader2 className="h-3 w-3 animate-spin" /> Indexing…
  </span>
)}
{(r.ingest_status === 'done' || r.ingested_at) && (
  <span className="flex items-center gap-1 text-xs text-green-500 shrink-0">
    <CheckCircle className="h-3 w-3" /> Indexed
  </span>
)}
{r.ingest_status === 'error' && (
  <span className="text-xs text-red-500 shrink-0">Index failed</span>
)}
```

- [ ] Remove `onIndexed` prop from `ResourceList` Props interface and all callers.

- [ ] Commit: `git commit -m "fix: auto-index resources on upload, fix bucket name, remove manual index button"`

---

## Task 3: Classroom Tab Restructure + Feed API

**Files:**
- Modify: `app/(app)/classroom/[id]/ClassroomPageClient.tsx`
- Create: `app/api/classrooms/[id]/feed/route.ts`
- Create: `app/api/classrooms/[id]/feed/[postId]/replies/route.ts`
- Create: `components/classroom/FeedTab.tsx`

### Steps

- [ ] In `ClassroomPageClient.tsx`, change the `Tab` type and tab list:

```typescript
// Change:
type Tab = 'projects' | 'assignments' | 'members' | 'report'
// To:
type Tab = 'projects' | 'assignments' | 'members' | 'feed'

// Change tabs array — remove Report, rename Members→Students, add Feed:
const tabs = isTeacher
  ? [
      { key: 'projects' as Tab, label: 'Projects', icon: BookOpen },
      { key: 'assignments' as Tab, label: 'Assignments', icon: ClipboardList },
      { key: 'members' as Tab, label: 'Students', icon: Users },
      { key: 'feed' as Tab, label: 'Feed', icon: MessageSquare },
    ]
  : [
      { key: 'projects' as Tab, label: 'Projects', icon: BookOpen },
      { key: 'assignments' as Tab, label: 'Assignments', icon: ClipboardList },
      { key: 'feed' as Tab, label: 'Feed', icon: MessageSquare },
    ]
```

- [ ] Add `import { MessageSquare } from 'lucide-react'` and `import { FeedTab } from '@/components/classroom/FeedTab'`

- [ ] Remove the entire `loadReport` function and the `report`/`reportLoading` state. Remove the `{tab === 'report' && ...}` JSX block. Change tab click handler to remove the `key === 'report' ? loadReport() :` ternary — just `setTab(key)`.

- [ ] Add Feed tab rendering after the members block:
```typescript
{tab === 'feed' && (
  <FeedTab classroomId={classroom.id} isTeacher={isTeacher} currentUserId={currentUserId} />
)}
```

- [ ] Create `app/api/classrooms/[id]/feed/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: posts } = await supabase
    .from('feed_posts')
    .select('*, author:author_id(email:id)')
    .eq('classroom_id', id)
    .order('created_at', { ascending: false })

  // Fetch replies for each post
  const postIds = (posts ?? []).map((p: any) => p.id)
  const { data: replies } = postIds.length
    ? await supabase.from('feed_replies').select('*').in('post_id', postIds).order('created_at', { ascending: true })
    : { data: [] }

  // Attach author emails via user_profiles
  const authorIds = [...new Set([...(posts ?? []).map((p: any) => p.author_id), ...(replies ?? []).map((r: any) => r.author_id)].filter(Boolean))]
  let emailMap: Record<string, string> = {}
  if (authorIds.length) {
    const { data: profiles } = await supabase.from('user_profiles').select('id, display_name').in('id', authorIds)
    emailMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.display_name ?? p.id.slice(0, 8)]))
  }

  const replyMap: Record<string, any[]> = {}
  for (const r of (replies ?? [])) {
    if (!replyMap[r.post_id]) replyMap[r.post_id] = []
    replyMap[r.post_id].push({ ...r, author_name: emailMap[r.author_id] ?? 'Unknown' })
  }

  const result = (posts ?? []).map((p: any) => ({
    ...p,
    author_name: emailMap[p.author_id] ?? 'Unknown',
    replies: replyMap[p.id] ?? [],
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, title, text } = body
  if (!type || !text) return NextResponse.json({ error: 'type and text required' }, { status: 400 })

  // Only teacher can post announcements
  if (type === 'announcement') {
    const { data: classroom } = await supabase.from('classrooms').select('teacher_id').eq('id', id).single()
    if (classroom?.teacher_id !== user.id) return NextResponse.json({ error: 'Only teacher can post announcements' }, { status: 403 })
  }

  const { data, error } = await supabase.from('feed_posts').insert({ classroom_id: id, author_id: user.id, type, title: title ?? null, body: text }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] Create `app/api/classrooms/[id]/feed/[postId]/replies/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { postId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { body, parent_reply_id } = await req.json()
  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 })
  const { data, error } = await supabase.from('feed_replies').insert({ post_id: postId, author_id: user.id, body, parent_reply_id: parent_reply_id ?? null }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] Create `components/classroom/FeedTab.tsx` — Announcements section (teacher-only post button) + Discussions section (both can post) + threaded replies (collapse/expand). Use the existing dark-theme CSS var style from ClassroomPageClient. Key structure:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { Megaphone, MessageSquare, ChevronDown, ChevronRight, Send, Loader2 } from 'lucide-react'

interface Reply {
  id: string; post_id: string; parent_reply_id: string | null
  author_name: string; body: string; created_at: string; replies?: Reply[]
}
interface Post {
  id: string; type: 'announcement' | 'discussion'
  title: string | null; body: string; author_name: string; created_at: string; replies: Reply[]
}

export function FeedTab({ classroomId, isTeacher, currentUserId }: { classroomId: string; isTeacher: boolean; currentUserId: string }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [newText, setNewText] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [postType, setPostType] = useState<'announcement' | 'discussion'>('discussion')
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: postType, title: newTitle || null, text: newText })
      })
      if (res.ok) { setNewText(''); setNewTitle(''); await load() }
    } finally { setPosting(false) }
  }

  async function submitReply() {
    if (!replyText.trim() || !replyTo) return
    setReplying(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/feed/${replyTo.postId}/replies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyText, parent_reply_id: replyTo.parentReplyId ?? null })
      })
      if (res.ok) { setReplyText(''); setReplyTo(null); await load() }
    } finally { setReplying(false) }
  }

  const announcements = posts.filter(p => p.type === 'announcement')
  const discussions = posts.filter(p => p.type === 'discussion')

  function toggleExpand(id: string) {
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function renderReplies(replies: Reply[], postId: string, depth = 0): React.ReactNode {
    return replies.map(r => (
      <div key={r.id} style={{ marginLeft: depth * 20, borderLeft: '2px solid var(--line)', paddingLeft: 12, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{r.author_name}</span>
          <span style={{ fontSize: 10, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>{new Date(r.created_at).toLocaleString()}</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 4px' }}>{r.body}</p>
        {depth < 3 && (
          <button onClick={() => setReplyTo({ postId, parentReplyId: r.id })} style={{ fontSize: 11, color: 'var(--mute)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Reply
          </button>
        )}
        {r.replies?.length ? renderReplies(r.replies, postId, depth + 1) : null}
        {replyTo?.parentReplyId === r.id && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…"
              style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--ink)' }} />
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
      <div style={{ borderRadius: 12, background: 'linear-gradient(180deg, rgba(21,21,29,0.75), rgba(15,15,21,0.75))', border: '1px solid var(--line)', overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ padding: '14px 16px' }}>
          {post.title && <p style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)', margin: '0 0 6px' }}>{post.title}</p>}
          <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0 }}>{post.body}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>{post.author_name} · {new Date(post.created_at).toLocaleString()}</span>
            <button onClick={() => toggleExpand(post.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--mute)', background: 'none', border: 'none', cursor: 'pointer' }}>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {post.replies.length} {post.replies.length === 1 ? 'reply' : 'replies'}
            </button>
            <button onClick={() => setReplyTo({ postId: post.id })} style={{ fontSize: 11, color: 'var(--mute)', background: 'none', border: 'none', cursor: 'pointer' }}>Reply</button>
          </div>
        </div>
        {isExpanded && post.replies.length > 0 && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px' }}>
            {renderReplies(post.replies, post.id)}
          </div>
        )}
        {replyTo?.postId === post.id && !replyTo.parentReplyId && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px', display: 'flex', gap: 8 }}>
            <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…"
              style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--ink)' }} />
            <button onClick={submitReply} disabled={replying} style={{ padding: '6px 12px', borderRadius: 8, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)', cursor: 'pointer' }}>
              {replying ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={12} />}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Compose */}
      <div style={{ borderRadius: 12, background: 'linear-gradient(180deg, rgba(21,21,29,0.75), rgba(15,15,21,0.75))', border: '1px solid var(--line)', padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {isTeacher && (
            <button onClick={() => setPostType('announcement')} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: postType === 'announcement' ? 'oklch(0.42 0.18 295 / 0.15)' : 'none', border: postType === 'announcement' ? '1px solid oklch(0.42 0.18 295 / 0.3)' : '1px solid var(--line)', color: postType === 'announcement' ? 'var(--purple-2)' : 'var(--mute)' }}>
              Announcement
            </button>
          )}
          <button onClick={() => setPostType('discussion')} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: postType === 'discussion' ? 'oklch(0.42 0.18 295 / 0.15)' : 'none', border: postType === 'discussion' ? '1px solid oklch(0.42 0.18 295 / 0.3)' : '1px solid var(--line)', color: postType === 'discussion' ? 'var(--purple-2)' : 'var(--mute)' }}>
            Discussion
          </button>
        </div>
        {postType === 'discussion' && (
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title (optional)" style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--ink)', marginBottom: 8, boxSizing: 'border-box' }} />
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder={postType === 'announcement' ? 'Write an announcement…' : 'Start a discussion…'} rows={3}
            style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--ink)', resize: 'vertical' }} />
          <button onClick={submitPost} disabled={posting || !newText.trim()} style={{ padding: '8px 14px', borderRadius: 8, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)', cursor: 'pointer', alignSelf: 'flex-end' }}>
            {posting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
          </button>
        </div>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Megaphone size={13} color="hsl(38 92% 65%)" />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'hsl(38 92% 65%)' }}>Announcements</span>
          </div>
          {announcements.map(p => <PostCard key={p.id} post={p} />)}
        </div>
      )}

      {/* Discussions */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <MessageSquare size={13} color="var(--purple-2)" />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--purple-2)' }}>Discussions</span>
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--mute)' }} /></div>
        ) : discussions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--mute)', fontSize: 13, fontFamily: 'var(--font-mono)', border: '1px dashed var(--line)', borderRadius: 12 }}>No discussions yet. Start one above!</div>
        ) : (
          discussions.map(p => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </div>
  )
}
```

- [ ] Commit: `git commit -m "feat: classroom tab restructure (Feed tab, remove Report tab, rename Members→Students)"`

---

## Task 4: Assignment Report Button + Modal

**Files:**
- Modify: `app/(app)/classroom/[id]/ClassroomPageClient.tsx`
- Create: `components/classroom/AssignmentReportDialog.tsx`
- Create: `app/api/classrooms/[id]/assignments/[assignmentId]/report/route.ts`

### Steps

- [ ] Create `app/api/classrooms/[id]/assignments/[assignmentId]/report/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deepseekCompletion } from '@/lib/ai/deepseek-client'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const { id: classroomId, assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: classroom } = await supabase.from('classrooms').select('teacher_id').eq('id', classroomId).single()
  if (classroom?.teacher_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: assignment }, { data: submissions }] = await Promise.all([
    supabase.from('classroom_assignments').select('*').eq('id', assignmentId).single(),
    supabase.from('assignment_submissions').select('*, student:student_id(email:id)').eq('assignment_id', assignmentId),
  ])

  if (!assignment || !submissions) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const scores = submissions.map((s: any) => s.score).filter((s: any) => s != null) as number[]
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  // Per-question analytics for MCQ
  const questions = Array.isArray(assignment.questions) ? assignment.questions : []
  const questionStats = questions.map((_q: any, qi: number) => {
    const answers = submissions.map((s: any) => {
      const ans = Array.isArray(s.answers) ? s.answers : []
      return ans[qi]
    })
    const correct = answers.filter((a: any) => a?.selected === _q.correct).length
    return { question: _q.question ?? `Q${qi + 1}`, correct, total: submissions.length, pct: submissions.length ? Math.round((correct / submissions.length) * 100) : 0 }
  })

  const hardest = questionStats.length ? questionStats.reduce((a, b) => a.pct < b.pct ? a : b) : null
  const easiest = questionStats.length ? questionStats.reduce((a, b) => a.pct > b.pct ? a : b) : null

  // Distribution buckets
  const distribution = { '0-39': 0, '40-69': 0, '70-89': 0, '90-100': 0 }
  for (const s of scores) {
    if (s < 40) distribution['0-39']++
    else if (s < 70) distribution['40-69']++
    else if (s < 90) distribution['70-89']++
    else distribution['90-100']++
  }

  // AI insight
  let insight = ''
  if (scores.length > 0) {
    try {
      insight = await deepseekCompletion({
        messages: [{ role: 'user', content: `Assignment: "${assignment.title}". ${scores.length} students submitted. Average score: ${avgScore}%. ${hardest ? `Hardest question: "${hardest.question}" (${hardest.pct}% correct).` : ''} ${easiest ? `Easiest: "${easiest.question}" (${easiest.pct}% correct).` : ''} Write one sentence of insight for the teacher about student performance.` }],
        temperature: 0.4, maxTokens: 120,
      })
    } catch { insight = '' }
  }

  return NextResponse.json({
    assignment,
    submissions: submissions.map((s: any) => ({ id: s.id, student_email: s.student?.email ?? s.student_id.slice(0, 8), score: s.score, submitted_at: s.submitted_at })),
    avgScore, distribution, questionStats, hardest, easiest, insight,
  })
}
```

- [ ] Create `components/classroom/AssignmentReportDialog.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { BarChart3, Loader2, X } from 'lucide-react'

interface Props { classroomId: string; assignmentId: string; assignmentTitle: string }

export function AssignmentReportDialog({ classroomId, assignmentId, assignmentTitle }: Props) {
  const [open, setOpen] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    if (report) { setOpen(true); return }
    setLoading(true); setOpen(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/assignments/${assignmentId}/report`)
      if (res.ok) setReport(await res.json())
    } finally { setLoading(false) }
  }

  return (
    <>
      <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, background: 'var(--bg-3)', border: '1px solid var(--line)', color: 'var(--mute)', fontSize: 11, cursor: 'pointer' }}>
        <BarChart3 size={11} /> Report
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f0f13', border: '1px solid var(--line)', borderRadius: 16, width: '90vw', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)' }}>{assignmentTitle} — Report</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--mute)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--mute)' }} /></div>}
              {report && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Submissions', value: report.submissions.length },
                      { label: 'Avg Score', value: report.avgScore != null ? `${report.avgScore}%` : '—' },
                      { label: 'Hardest Q', value: report.hardest ? `${report.hardest.pct}% correct` : '—' },
                    ].map(c => (
                      <div key={c.label} style={{ padding: 14, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--line)', textAlign: 'center' }}>
                        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', margin: '0 0 4px' }}>{c.value}</p>
                        <p style={{ fontSize: 11, color: 'var(--mute)', margin: 0, fontFamily: 'var(--font-mono)' }}>{c.label}</p>
                      </div>
                    ))}
                  </div>
                  {/* Distribution */}
                  <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--line)' }}>
                    <p style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Score Distribution</p>
                    {Object.entries(report.distribution).map(([range, count]: any) => (
                      <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--mute)', width: 60 }}>{range}%</span>
                        <div style={{ flex: 1, height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: 'var(--purple)', borderRadius: 4, width: report.submissions.length ? `${(count / report.submissions.length) * 100}%` : '0%', transition: 'width 0.5s' }} />
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', width: 20 }}>{count}</span>
                      </div>
                    ))}
                  </div>
                  {/* AI Insight */}
                  {report.insight && (
                    <div style={{ padding: 14, borderRadius: 10, background: 'oklch(0.42 0.18 295 / 0.08)', border: '1px solid oklch(0.42 0.18 295 / 0.2)' }}>
                      <p style={{ fontSize: 12, color: 'var(--purple-2)', margin: 0, fontStyle: 'italic' }}>💡 {report.insight}</p>
                    </div>
                  )}
                  {/* Per-student table */}
                  <div style={{ borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--line)' }}>
                          {['Student', 'Score', 'Submitted'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mute)' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {report.submissions.map((s: any, i: number) => (
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--ink)' }}>{s.student_email}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: s.score >= 70 ? 'oklch(0.72 0.18 145)' : s.score >= 40 ? 'hsl(38 92% 65%)' : 'hsl(0 85% 70%)' }}>{s.score != null ? `${s.score}%` : '—'}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>{new Date(s.submitted_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] In `ClassroomPageClient.tsx`, import `AssignmentReportDialog` and add the Report button to each assignment row (teacher only), next to the existing Submissions button:

```typescript
// Add import:
import { AssignmentReportDialog } from '@/components/classroom/AssignmentReportDialog'

// Inside assignments.map(), in the isTeacher block, add the report button next to submissions button:
{isTeacher && (
  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
    <AssignmentReportDialog classroomId={classroom.id} assignmentId={a.id} assignmentTitle={a.title} />
    {/* existing Submissions button stays */}
    <button onClick={() => toggleAssignmentSubmissions(a.id)} ...>...</button>
  </div>
)}
```

- [ ] Commit: `git commit -m "feat: per-assignment report button with score distribution, AI insight, per-student table"`

---

## Task 5: Assignment Creator — AI Generate + Auto-Correct Toggle

**Files:**
- Modify: `components/classroom/AssignmentCreatorDialog.tsx`

### Steps

- [ ] Read the full current `components/classroom/AssignmentCreatorDialog.tsx` first.

- [ ] Rewrite as a 3-step wizard. Step 1: title/description/deadline. Step 2: topic selection (from classroom projects' topics OR free-form) + AI Generate button. Step 3: format (MCQ/descriptive/both) + auto-correct toggle.

Key additions to the existing component:
```typescript
// New state:
const [step, setStep] = useState(1)
const [autoCorrect, setAutoCorrect] = useState(true)
const [aiTopics, setAiTopics] = useState('')
const [aiGenerating, setAiGenerating] = useState(false)

// AI generate handler:
async function handleAiGenerate() {
  if (!aiTopics.trim()) return
  setAiGenerating(true)
  try {
    const res = await fetch('/api/generate-questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topics: aiTopics, type, numQuestions: 5 }),
    })
    const data = await res.json()
    if (res.ok) {
      if (type === 'mcq') setMcqQuestions(data.questions)
      else setDescQuestions(data.questions)
    }
  } finally { setAiGenerating(false) }
}
```

- [ ] Create `app/api/generate-questions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deepseekCompletion } from '@/lib/ai/deepseek-client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topics, type, numQuestions = 5 } = await req.json()
  if (!topics) return NextResponse.json({ error: 'topics required' }, { status: 400 })

  const prompt = type === 'mcq'
    ? `Generate ${numQuestions} multiple choice questions about: ${topics}. Return JSON array: [{question, options: [4 strings], correct: 0-3 index}]. Only JSON, no markdown.`
    : `Generate ${numQuestions} descriptive questions about: ${topics}. Return JSON array: [{question, expectedAnswer}]. Only JSON, no markdown.`

  const raw = await deepseekCompletion({ messages: [{ role: 'user', content: prompt }], temperature: 0.6, maxTokens: 2000 })
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return NextResponse.json({ error: 'AI failed to generate valid JSON' }, { status: 500 })

  try {
    const questions = JSON.parse(match[0])
    return NextResponse.json({ questions })
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }
}
```

- [ ] Add `auto_correct` to the assignment creation POST body in `handleCreate`.

- [ ] Include the auto-correct toggle in Step 3 UI:
```typescript
<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
  <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Auto-correct descriptive answers</span>
  <button onClick={() => setAutoCorrect(a => !a)} style={{
    width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
    background: autoCorrect ? 'var(--purple)' : 'var(--bg-3)', border: '1px solid var(--line)',
    transition: 'background 0.2s',
  }}>
    <div style={{ position: 'absolute', top: 2, left: autoCorrect ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
  </button>
</div>
```

- [ ] Commit: `git commit -m "feat: assignment creator 3-step wizard with AI question generation and auto-correct toggle"`

---

## Task 6: Project File View + View Toggle

**Files:**
- Create: `components/FileView.tsx`
- Modify: `app/(app)/project/[id]/ProjectPageClient.tsx`

### Steps

- [ ] Create `components/FileView.tsx`:

```typescript
'use client'
import Link from 'next/link'
import { CheckCircle, Lock, Unlock, FileText } from 'lucide-react'
import type { Topic } from '@/lib/supabase/types'

interface Props { topics: Topic[]; projectId: string; resourceCount: Record<string, number> }

const statusConfig = {
  done: { label: 'Done', color: 'oklch(0.72 0.18 145)', bg: 'oklch(0.72 0.18 145 / 0.08)', border: 'oklch(0.72 0.18 145 / 0.25)', Icon: CheckCircle },
  unlocked: { label: 'In Progress', color: 'var(--purple-2)', bg: 'oklch(0.42 0.18 295 / 0.08)', border: 'oklch(0.42 0.18 295 / 0.25)', Icon: Unlock },
  locked: { label: 'Locked', color: 'var(--mute)', bg: 'rgba(255,255,255,0.03)', border: 'var(--line)', Icon: Lock },
}

export function FileView({ topics, projectId, resourceCount }: Props) {
  if (topics.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mute)', fontSize: 13, fontFamily: 'var(--font-mono)', border: '1px dashed var(--line)', borderRadius: 14 }}>
        No topics yet.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, padding: 4 }}>
      {topics.map(t => {
        const cfg = statusConfig[t.status]
        const rc = resourceCount[t.id] ?? 0
        return (
          <Link key={t.id} href={`/project/${projectId}/topic/${t.id}`} style={{ textDecoration: 'none' }}>
            <div style={{
              borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              transition: 'all 0.15s', position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <cfg.Icon size={14} color={cfg.color} />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: cfg.color, padding: '2px 6px', borderRadius: 5, background: `${cfg.border}`, border: `1px solid ${cfg.border}` }}>
                  {cfg.label}
                </span>
              </div>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{t.name}</p>
              {rc > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--mute)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                  <FileText size={10} /> {rc} resource{rc !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] In `ProjectPageClient.tsx`, add state and toggle:

```typescript
// Add to imports:
import { FileView } from '@/components/FileView'
import { LayoutGrid, Network } from 'lucide-react'

// Add state:
const [viewMode, setViewMode] = useState<'tree' | 'file'>('tree')

// Build resourceCount map:
const resourceCount = resources.reduce((acc, r) => {
  // resources don't have topic_id yet — map to 0 for now
  return acc
}, {} as Record<string, number>)

// In header, add toggle button after existing buttons:
<div style={{ display: 'flex', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
  {[{ mode: 'tree' as const, Icon: Network, label: 'Graph' }, { mode: 'file' as const, Icon: LayoutGrid, label: 'Cards' }].map(({ mode, Icon, label }) => (
    <button key={mode} onClick={() => setViewMode(mode)} style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
      background: viewMode === mode ? 'oklch(0.42 0.18 295 / 0.15)' : 'none',
      border: 'none', color: viewMode === mode ? 'var(--purple-2)' : 'var(--mute)',
      fontSize: 11, cursor: 'pointer',
    }}>
      <Icon size={12} /> {label}
    </button>
  ))}
</div>

// Replace TopicGraph conditional with:
{viewMode === 'tree' ? (
  <TopicGraph topics={topics} edges={edges} projectId={project.id} />
) : (
  <FileView topics={topics} projectId={project.id} resourceCount={resourceCount} />
)}
```

- [ ] Commit: `git commit -m "feat: file view (card grid) with status colors + view toggle in project page"`

---

## Task 7: Multiple Chat Sessions

**Files:**
- Create: `app/api/topic/[id]/sessions/route.ts`
- Create: `app/api/topic/[id]/sessions/[sessionId]/route.ts`
- Modify: `components/TopicPageClient.tsx`
- Modify: `lib/chat/node-chat-service.ts`
- Modify: `app/(app)/project/[id]/topic/[topicId]/page.tsx`

### Steps

- [ ] Create `app/api/topic/[id]/sessions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: topicId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase.from('chat_sessions').select('*').eq('topic_id', topicId).eq('user_id', user.id).order('created_at', { ascending: true })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: topicId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name } = await req.json().catch(() => ({}))
  const { data: existing } = await supabase.from('chat_sessions').select('id').eq('topic_id', topicId).eq('user_id', user.id)
  const sessionName = name || `Chat ${(existing?.length ?? 0) + 1}`
  const { data, error } = await supabase.from('chat_sessions').insert({ topic_id: topicId, user_id: user.id, name: sessionName }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] Create `app/api/topic/[id]/sessions/[sessionId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] Modify `lib/chat/node-chat-service.ts` — update `saveChatMessage` to accept optional `sessionId` and `getNodeChatHistory` to filter by `sessionId`:

```typescript
export async function saveChatMessage(topicId: string, role: 'user' | 'assistant', content: string, sessionId?: string): Promise<void> {
  const insert: any = { topic_id: topicId, role, content }
  if (sessionId) insert.session_id = sessionId
  const { error } = await supabase.from('chat_messages').insert(insert)
  if (error) throw error
}

export async function getNodeChatHistory(topicId: string, limit = 50, sessionId?: string): Promise<Message[]> {
  let q = supabase.from('chat_messages').select('role, content').eq('topic_id', topicId)
  if (sessionId) q = q.eq('session_id', sessionId)
  else q = q.is('session_id', null)
  const { data, error } = await q.order('created_at', { ascending: true }).limit(limit)
  if (error) throw error
  return (data ?? []).map((m: any) => ({ role: m.role, content: m.content }))
}
```

- [ ] Update `app/(app)/project/[id]/topic/[topicId]/page.tsx` to accept and pass `sessionId` from searchParams:

```typescript
interface Props { params: Promise<{ id: string; topicId: string }>; searchParams: Promise<{ session?: string }> }

export default async function TopicPage({ params, searchParams }: Props) {
  const { id, topicId } = await params
  const { session: sessionId } = await searchParams
  const [topic, history] = await Promise.all([
    getTopic(topicId),
    getNodeChatHistory(topicId, 100, sessionId),
  ])
  if (!topic) notFound()
  const messages = history.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  return <TopicPageClient topic={topic} projectId={id} initialMessages={messages} sessionId={sessionId} />
}
```

- [ ] Modify `TopicPageClient.tsx` to add session selector UI. Add prop `sessionId?: string`. Add session management state, fetch sessions on mount, render dropdown/strip at top of page with "+ New Chat" and delete per session. Pass `sessionId` to `NodeChat`. When session changes, navigate to `?session=<id>`:

```typescript
// Add to props interface:
sessionId?: string

// In component body, add:
const [sessions, setSessions] = useState<Array<{id: string; name: string}>>([])
const [activeSession, setActiveSession] = useState<string | undefined>(sessionId)
const router = useRouter()

useEffect(() => {
  fetch(`/api/topic/${topic.id}/sessions`).then(r => r.json()).then(setSessions)
}, [topic.id])

async function createSession() {
  const res = await fetch(`/api/topic/${topic.id}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
  const s = await res.json()
  setSessions(prev => [...prev, s])
  router.push(`?session=${s.id}`)
}

async function deleteSession(id: string) {
  await fetch(`/api/topic/${topic.id}/sessions/${id}`, { method: 'DELETE' })
  setSessions(prev => prev.filter(s => s.id !== id))
  if (activeSession === id) router.push(`/project/${projectId}/topic/${topic.id}`)
}
```

- [ ] Add session strip UI in the header area (between header and NodeChat):

```typescript
{sessions.length > 0 && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 24px', borderBottom: '1px solid var(--line)', background: 'rgba(15,15,21,0.5)', overflowX: 'auto' }}>
    {sessions.map(s => (
      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, flexShrink: 0, background: activeSession === s.id ? 'oklch(0.42 0.18 295 / 0.15)' : 'none', border: activeSession === s.id ? '1px solid oklch(0.42 0.18 295 / 0.3)' : '1px solid var(--line)' }}>
        <button onClick={() => { setActiveSession(s.id); router.push(`?session=${s.id}`) }} style={{ fontSize: 11, color: activeSession === s.id ? 'var(--purple-2)' : 'var(--mute)', background: 'none', border: 'none', cursor: 'pointer' }}>{s.name}</button>
        <button onClick={() => deleteSession(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: 0 }}><X size={10} /></button>
      </div>
    ))}
    <button onClick={createSession} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, background: 'none', border: '1px dashed var(--line)', color: 'var(--mute)', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
      <Plus size={10} /> New Chat
    </button>
  </div>
)}
```

- [ ] Add `import { useRouter } from 'next/navigation'` and `import { Plus, X } from 'lucide-react'` to `TopicPageClient.tsx`.

- [ ] Commit: `git commit -m "feat: multiple isolated chat sessions per topic with create/delete/switch"`

---

## Task 8: Resources Panel in Chat View (Collapsible)

**Files:**
- Modify: `components/TopicPageClient.tsx`
- Modify: `app/(app)/project/[id]/topic/[topicId]/page.tsx`

### Steps

- [ ] In the topic page server component, fetch resources for the project and pass them down. Add to `app/(app)/project/[id]/topic/[topicId]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
// In the page function, after fetching topic:
const supabase = await createClient()
const { data: resources } = await supabase.from('resources').select('*').eq('project_id', id).order('created_at', { ascending: false })

return <TopicPageClient topic={topic} projectId={id} initialMessages={messages} sessionId={sessionId} resources={resources ?? []} />
```

- [ ] In `TopicPageClient.tsx`, add `resources` prop and collapsible panel layout:

```typescript
import { ResourceList } from '@/components/resource/ResourceList'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Resource } from '@/lib/supabase/types'

// Add to props:
resources?: Resource[]

// Add state:
const [panelOpen, setPanelOpen] = useState(true)
// On mount, check window width; collapse if mobile:
useEffect(() => { if (window.innerWidth < 1024) setPanelOpen(false) }, [])

// Change the outer layout to flex row:
<div className="flex flex-col h-screen bg-gray-950">
  <header>...</header>
  {/* session strip */}
  <div className="flex flex-1 overflow-hidden">
    {/* Chat area */}
    <div className="flex-1 overflow-hidden">
      <NodeChat topicId={topic.id} topicName={topic.name} initialMessages={initialMessages} sessionId={activeSession} />
    </div>
    {/* Resources panel */}
    <div style={{
      width: panelOpen ? 280 : 0, flexShrink: 0, overflow: 'hidden',
      borderLeft: panelOpen ? '1px solid #1f2937' : 'none',
      background: '#111827', transition: 'width 0.25s ease',
      display: 'flex', flexDirection: 'column',
    }}>
      {panelOpen && (
        <>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Resources</span>
            <button onClick={() => setPanelOpen(false)} className="text-gray-600 hover:text-gray-400"><ChevronRight size={14} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            <ResourceList resources={resources ?? []} projectId={projectId} onDelete={() => {}} />
          </div>
        </>
      )}
    </div>
    {/* Toggle button when closed */}
    {!panelOpen && (
      <button onClick={() => setPanelOpen(true)} style={{
        position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
        background: '#1f2937', border: '1px solid #374151', borderRight: 'none',
        borderRadius: '8px 0 0 8px', padding: '8px 6px', cursor: 'pointer', color: '#6b7280',
      }}>
        <ChevronLeft size={14} />
      </button>
    )}
  </div>
</div>
```

- [ ] Note: The outer `<div className="flex-1 overflow-hidden">` that wraps NodeChat needs `position: relative` so the toggle button positions correctly.

- [ ] Commit: `git commit -m "feat: collapsible resources panel in topic chat view"`

---

## Task 9: User Tree Builder

**Files:**
- Create: `components/UserTreeBuilder.tsx`
- Create: `app/api/project/[id]/user-tree/route.ts`
- Modify: Dashboard project creation dialog (find the file that creates projects)
- Modify: `app/(app)/project/[id]/ProjectPageClient.tsx`

### Steps

- [ ] Find the project creation dialog. Check `app/(app)/dashboard/DashboardClient.tsx` for where projects are created. Read it first.

- [ ] Create `app/api/project/[id]/user-tree/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase.from('user_tree_nodes').select('*').eq('project_id', projectId).order('position', { ascending: true })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const nodes = await req.json() // array of { name, parent_id?, description? }
  await supabase.from('user_tree_nodes').delete().eq('project_id', projectId).eq('user_id', user.id)
  const rows = nodes.map((n: any, i: number) => ({ project_id: projectId, user_id: user.id, name: n.name, description: n.description ?? null, parent_id: n.parent_id ?? null, position: i }))
  const { data, error } = await supabase.from('user_tree_nodes').insert(rows).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Also set path_mode = 'custom'
  await supabase.from('projects').update({ path_mode: 'custom' }).eq('id', projectId)
  return NextResponse.json(data)
}
```

- [ ] Create `components/UserTreeBuilder.tsx` — a dialog with a form to add topics, set parent, and reorder:

```typescript
'use client'
import { useState } from 'react'
import { Plus, Trash2, Save, Loader2 } from 'lucide-react'

interface TreeNode { tempId: string; name: string; description: string; parentTempId: string | null }

interface Props { projectId: string; onSaved: () => void }

export function UserTreeBuilder({ projectId, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [nodes, setNodes] = useState<TreeNode[]>([{ tempId: '1', name: '', description: '', parentTempId: null }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addNode() {
    setNodes(n => [...n, { tempId: Date.now().toString(), name: '', description: '', parentTempId: null }])
  }

  function removeNode(tempId: string) {
    setNodes(n => n.filter(x => x.tempId !== tempId).map(x => x.parentTempId === tempId ? { ...x, parentTempId: null } : x))
  }

  async function save() {
    const valid = nodes.filter(n => n.name.trim())
    if (!valid.length) { setError('Add at least one topic'); return }
    setSaving(true); setError(null)
    try {
      const idMap: Record<string, string | null> = {}
      const payload = valid.map(n => ({ name: n.name.trim(), description: n.description.trim() || null, parent_id: n.parentTempId ? idMap[n.parentTempId] ?? null : null }))
      const res = await fetch(`/api/project/${projectId}/user-tree`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { setError('Failed to save'); return }
      setOpen(false); onSaved()
    } finally { setSaving(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--line)', color: 'var(--mute)', fontSize: 12, cursor: 'pointer' }}>
        Edit Path
      </button>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f0f13', border: '1px solid var(--line)', borderRadius: 16, width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', margin: 0 }}>Build Your Learning Path</p>
              <p style={{ fontSize: 12, color: 'var(--mute)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>Add topics and set their prerequisites</p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {nodes.map((node, i) => (
                <div key={node.tempId} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input value={node.name} onChange={e => setNodes(n => n.map(x => x.tempId === node.tempId ? { ...x, name: e.target.value } : x))}
                      placeholder={`Topic ${i + 1} name`}
                      style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: 'var(--ink)', width: '100%' }} />
                    <select value={node.parentTempId ?? ''} onChange={e => setNodes(n => n.map(x => x.tempId === node.tempId ? { ...x, parentTempId: e.target.value || null } : x))}
                      style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 8px', fontSize: 12, color: 'var(--mute)' }}>
                      <option value=''>No prerequisite (root)</option>
                      {nodes.filter(n => n.tempId !== node.tempId && n.name.trim()).map(n => <option key={n.tempId} value={n.tempId}>{n.name}</option>)}
                    </select>
                  </div>
                  <button onClick={() => removeNode(node.tempId)} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', marginTop: 2 }}><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={addNode} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', background: 'none', border: '1px dashed var(--line)', borderRadius: 8, color: 'var(--mute)', fontSize: 12, cursor: 'pointer', justifyContent: 'center' }}>
                <Plus size={13} /> Add Topic
              </button>
              {error && <p style={{ color: 'hsl(0 85% 70%)', fontSize: 12, fontFamily: 'var(--font-mono)', margin: 0 }}>{error}</p>}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)', fontSize: 13, cursor: 'pointer' }}>
                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />} Save Path
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] In `ProjectPageClient.tsx`, import and render `<UserTreeBuilder projectId={project.id} onSaved={() => window.location.reload()} />` in the header toolbar.

- [ ] Commit: `git commit -m "feat: user-defined learning path builder with topic hierarchy form"`

---

## Task 10: Project-Level Generate Test

**Files:**
- Create: `components/GenerateTestDialog.tsx`
- Create: `app/api/project/[id]/generate-test/route.ts`
- Modify: `app/(app)/project/[id]/ProjectPageClient.tsx`

### Steps

- [ ] Create `app/api/project/[id]/generate-test/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deepseekCompletion } from '@/lib/ai/deepseek-client'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topicIds, customTopics, format } = await req.json()
  let topicNames: string[] = []

  if (topicIds?.length) {
    const { data: topics } = await supabase.from('topics').select('name').in('id', topicIds)
    topicNames = (topics ?? []).map((t: any) => t.name)
  }
  if (customTopics?.trim()) topicNames.push(...customTopics.split(',').map((t: string) => t.trim()).filter(Boolean))
  if (!topicNames.length) return NextResponse.json({ error: 'No topics provided' }, { status: 400 })

  const topicStr = topicNames.join(', ')
  const numQ = 5

  const genMcq = async () => {
    const raw = await deepseekCompletion({ messages: [{ role: 'user', content: `Generate ${numQ} MCQ about: ${topicStr}. Return JSON array: [{question, options: [4 strings], correct: 0-3}]. Only JSON.` }], temperature: 0.6, maxTokens: 2000 })
    const m = raw.match(/\[[\s\S]*\]/)
    return m ? JSON.parse(m[0]) : []
  }

  const genDesc = async () => {
    const raw = await deepseekCompletion({ messages: [{ role: 'user', content: `Generate ${numQ} descriptive questions about: ${topicStr}. Return JSON array: [{question, expectedAnswer}]. Only JSON.` }], temperature: 0.6, maxTokens: 2000 })
    const m = raw.match(/\[[\s\S]*\]/)
    return m ? JSON.parse(m[0]) : []
  }

  let mcq: any[] = [], desc: any[] = []
  if (format === 'mcq' || format === 'both') mcq = await genMcq()
  if (format === 'descriptive' || format === 'both') desc = await genDesc()

  // Store as assessment result
  const { data: result } = await supabase.from('assessment_results').insert({ topic_id: topicIds?.[0] ?? null, mode: format === 'both' ? 'mcq' : format, score: null, max_score: (mcq.length + desc.length) * 10 }).select().single()

  return NextResponse.json({ id: result?.id, mcq, desc, topics: topicNames })
}
```

- [ ] Create `components/GenerateTestDialog.tsx` — Dialog with step 1 (topic checkboxes from passed topics array + custom topics textarea + format picker) and step 2 (renders the generated quiz inline, same MCQ UI as NodeChat):

```typescript
'use client'
import { useState } from 'react'
import { TestTube2, Loader2, CheckCircle, X } from 'lucide-react'
import type { Topic } from '@/lib/supabase/types'

interface Props { projectId: string; topics: Topic[] }

export function GenerateTestDialog({ projectId, topics }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [customTopics, setCustomTopics] = useState('')
  const [format, setFormat] = useState<'mcq' | 'descriptive' | 'both'>('mcq')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)

  function toggleTopic(id: string) { setSelectedTopics(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]) }

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/project/${projectId}/generate-test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topicIds: selectedTopics, customTopics, format }) })
      const data = await res.json()
      if (res.ok) { setResult(data); setStep(2) }
    } finally { setLoading(false) }
  }

  function calcScore() {
    if (!result?.mcq) return 0
    let correct = 0
    result.mcq.forEach((q: any, i: number) => { if (mcqAnswers[i] === q.correct) correct++ })
    return Math.round((correct / result.mcq.length) * 100)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'oklch(0.42 0.18 295 / 0.1)', border: '1px solid oklch(0.42 0.18 295 / 0.25)', color: 'var(--purple-2)', fontSize: 12, cursor: 'pointer' }}>
        <TestTube2 size={13} /> Generate Test
      </button>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => { setOpen(false); setStep(1); setResult(null); setSubmitted(false) }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f0f13', border: '1px solid var(--line)', borderRadius: 16, width: '92vw', maxWidth: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)' }}>{step === 1 ? 'Generate Test' : 'Practice Test'}</span>
              <button onClick={() => { setOpen(false); setStep(1); setResult(null); setSubmitted(false) }} style={{ background: 'none', border: 'none', color: 'var(--mute)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--font-mono)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Select Topics</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {topics.map(t => (
                        <button key={t.id} onClick={() => toggleTopic(t.id)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: selectedTopics.includes(t.id) ? 'oklch(0.42 0.18 295 / 0.15)' : 'var(--bg-3)', border: selectedTopics.includes(t.id) ? '1px solid oklch(0.42 0.18 295 / 0.4)' : '1px solid var(--line)', color: selectedTopics.includes(t.id) ? 'var(--purple-2)' : 'var(--mute)' }}>
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--font-mono)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Custom Topics (comma-separated)</p>
                    <input value={customTopics} onChange={e => setCustomTopics(e.target.value)} placeholder="e.g. Recursion, Big-O Notation" style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--ink)', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--font-mono)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Format</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['mcq', 'descriptive', 'both'] as const).map(f => (
                        <button key={f} onClick={() => setFormat(f)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: format === f ? 'oklch(0.42 0.18 295 / 0.15)' : 'none', border: format === f ? '1px solid oklch(0.42 0.18 295 / 0.3)' : '1px solid var(--line)', color: format === f ? 'var(--purple-2)' : 'var(--mute)' }}>
                          {f === 'mcq' ? 'MCQ' : f === 'descriptive' ? 'Descriptive' : 'Both'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {step === 2 && result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {result.mcq?.map((q: any, i: number) => (
                    <div key={i} style={{ padding: 16, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--line)' }}>
                      <p style={{ fontSize: 14, color: 'var(--ink)', margin: '0 0 12px', fontWeight: 500 }}>{i + 1}. {q.question}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {q.options.map((opt: string, oi: number) => {
                          const isSelected = mcqAnswers[i] === oi
                          const isCorrect = submitted && oi === q.correct
                          const isWrong = submitted && isSelected && oi !== q.correct
                          return (
                            <button key={oi} disabled={submitted} onClick={() => setMcqAnswers(a => ({ ...a, [i]: oi }))} style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: submitted ? 'default' : 'pointer', background: isCorrect ? 'oklch(0.72 0.18 145 / 0.15)' : isWrong ? 'hsl(0 85% 70% / 0.15)' : isSelected ? 'oklch(0.42 0.18 295 / 0.15)' : 'rgba(255,255,255,0.03)', border: isCorrect ? '1px solid oklch(0.72 0.18 145 / 0.4)' : isWrong ? '1px solid hsl(0 85% 70% / 0.4)' : isSelected ? '1px solid oklch(0.42 0.18 295 / 0.3)' : '1px solid var(--line)', color: 'var(--ink)' }}>
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  {submitted && result.mcq?.length > 0 && (
                    <div style={{ padding: 16, borderRadius: 12, background: 'oklch(0.42 0.18 295 / 0.08)', border: '1px solid oklch(0.42 0.18 295 / 0.2)', textAlign: 'center' }}>
                      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--purple-2)', margin: '0 0 4px' }}>{calcScore()}%</p>
                      <p style={{ fontSize: 12, color: 'var(--mute)', margin: 0 }}>Score</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {step === 1 && (
                <button onClick={generate} disabled={loading || (selectedTopics.length === 0 && !customTopics.trim())} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 9, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)', fontSize: 13, cursor: 'pointer' }}>
                  {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <TestTube2 size={14} />} Generate
                </button>
              )}
              {step === 2 && !submitted && result?.mcq?.length > 0 && (
                <button onClick={() => setSubmitted(true)} style={{ padding: '8px 18px', borderRadius: 9, background: 'oklch(0.72 0.18 145 / 0.15)', border: '1px solid oklch(0.72 0.18 145 / 0.3)', color: 'oklch(0.72 0.18 145)', fontSize: 13, cursor: 'pointer' }}>
                  <CheckCircle size={14} style={{ display: 'inline', marginRight: 6 }} /> Submit
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] In `ProjectPageClient.tsx`, import and add `<GenerateTestDialog projectId={project.id} topics={topics} />` to the header toolbar.

- [ ] Commit: `git commit -m "feat: project-level generate test dialog (MCQ + descriptive, topic selection)"`

---

## Task 11: Create Project Inside Classroom + Resources Overflow Fix

**Files:**
- Modify: `app/(app)/classroom/[id]/ClassroomPageClient.tsx`
- Modify: `app/(app)/project/[id]/ProjectPageClient.tsx` (resources overflow)

### Steps

- [ ] Fix resources overflow in `ProjectPageClient.tsx` — the aside already has `overflow-hidden` but the inner div needs constrained height. Ensure:

```typescript
// The aside element:
<aside className="w-72 border-l border-gray-800 flex flex-col shrink-0 overflow-hidden bg-gray-900" style={{ height: '100%' }}>
  <div className="p-4 border-b border-gray-800 flex items-center justify-between gap-2 shrink-0">
    {/* header stays */}
  </div>
  <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0 }}>
    <ResourceList ... />
  </div>
</aside>
```

The key fix is `flex-1 overflow-y-auto` with `minHeight: 0` on the scrollable container so it doesn't overflow its parent.

- [ ] In `ClassroomPageClient.tsx`, add a "New Project" button in the Projects tab header. When clicked, shows a small inline form (or dialog) to create a project directly tied to this classroom:

```typescript
// Add state:
const [creatingProject, setCreatingProject] = useState(false)
const [newProjectName, setNewProjectName] = useState('')
const [newProjectTopic, setNewProjectTopic] = useState('')
const [projectCreating, setProjectCreating] = useState(false)

async function createProject() {
  if (!newProjectName.trim()) return
  setProjectCreating(true)
  try {
    // Create project
    const res = await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newProjectName.trim(), main_topic: newProjectTopic.trim() || null }),
    })
    const proj = await res.json()
    if (!res.ok) return
    // Assign to classroom
    await fetch(`/api/projects/${proj.id}/assign-classroom`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classroomId: classroom.id }),
    })
    setCreatingProject(false); setNewProjectName(''); setNewProjectTopic('')
    window.location.reload()
  } finally { setProjectCreating(false) }
}
```

- [ ] Add the Create Project button and inline form to the Projects tab rendering:

```typescript
{tab === 'projects' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    {isTeacher && (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {!creatingProject ? (
          <button onClick={() => setCreatingProject(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: 'oklch(0.42 0.18 295 / 0.1)', border: '1px solid oklch(0.42 0.18 295 / 0.25)', color: 'var(--purple-2)', fontSize: 12, cursor: 'pointer' }}>
            <Plus size={13} /> New Project
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Project name" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--ink)' }} />
            <input value={newProjectTopic} onChange={e => setNewProjectTopic(e.target.value)} placeholder="Main topic" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--ink)' }} />
            <button onClick={createProject} disabled={projectCreating} style={{ padding: '6px 12px', borderRadius: 8, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)', fontSize: 12, cursor: 'pointer' }}>
              {projectCreating ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create'}
            </button>
            <button onClick={() => setCreatingProject(false)} style={{ background: 'none', border: 'none', color: 'var(--mute)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          </div>
        )}
      </div>
    )}
    {/* existing projects grid */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
      {/* existing project cards */}
    </div>
  </div>
)}
```

- [ ] Add `import { Plus } from 'lucide-react'` if not already imported.

- [ ] Commit: `git commit -m "feat: create project inside classroom, fix resources overflow"`

---

## Verification

After all tasks are committed:
- [ ] Run `npm run build` — check for TypeScript errors
- [ ] Verify classroom page shows 4 tabs: Projects, Assignments, Students, Feed (no Report tab)
- [ ] Verify Feed tab renders with post form and announcement/discussion sections
- [ ] Verify assignment rows show Report button for teacher
- [ ] Verify project page shows Tree/File toggle — File view shows topic cards
- [ ] Verify topic chat page shows session strip (if sessions exist) and resources panel on the right
- [ ] Verify uploading a resource no longer shows manual Index button; shows Indexing... badge
- [ ] Verify Generate Test dialog opens, lets you pick topics, generates questions
- [ ] Verify Edit Path button opens tree builder dialog
