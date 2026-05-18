# OneLearn — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the OneLearn Next.js 15 application with Supabase auth, database schema, and project/topic/resource management UI — the foundation all other features build on.

**Architecture:** App Router Next.js 15. Server Components for data fetching; Client Components only for forms and interactive UI. Supabase JS client (browser + server variants) for auth and database. No ORM — direct Supabase query helpers typed against a hand-maintained `types.ts`. The app is split into route groups: `(auth)` for unauthenticated pages and `(app)` for the protected shell.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, shadcn/ui, Supabase (Auth + Postgres + Storage + pgvector), Vitest + Testing Library for unit tests.

---

> **Scope note — 6 plans total:**
> - **Plan 1 (this):** Auth + Project/Topic/Resource management shell
> - **Plan 2:** Knowledge graph generation + react-flow DAG visualisation
> - **Plan 3:** Resource ingestion pipeline (PDF/DOCX/YouTube → RAG chunks)
> - **Plan 4:** Topic chat with streaming, RAG retrieval, memory, web search
> - **Plan 5:** Assessment tools (MCQ + Descriptive + MathPix OCR)
> - **Plan 6:** YouTube deep analysis + Summary PDF export

---

## Files Created

```
next.config.ts
tailwind.config.ts
vitest.config.ts
vitest.setup.ts
.env.example
middleware.ts

lib/supabase/client.ts
lib/supabase/server.ts
lib/supabase/types.ts

lib/db/projects.ts
lib/db/topics.ts
lib/db/resources.ts
lib/db/__tests__/projects.test.ts

supabase/migrations/001_initial_schema.sql

app/layout.tsx
app/page.tsx
app/(auth)/layout.tsx
app/(auth)/login/page.tsx
app/(auth)/signup/page.tsx
app/auth/callback/route.ts

app/(app)/layout.tsx
app/(app)/dashboard/page.tsx
app/(app)/dashboard/DashboardClient.tsx
app/(app)/project/[id]/page.tsx
app/(app)/project/[id]/ProjectPageClient.tsx
app/(app)/project/[id]/topic/[topicId]/page.tsx

app/api/projects/route.ts
app/api/topics/route.ts
app/api/resources/route.ts

components/layout/Sidebar.tsx
components/project/ProjectCard.tsx
components/project/CreateProjectDialog.tsx
components/topic/TopicList.tsx
components/topic/AddTopicDialog.tsx
components/resource/ResourceList.tsx
components/resource/AddResourceDialog.tsx
```

---

## Task 1: Scaffold Next.js 15 Project

**Files:** entire project bootstrapped via create-next-app; `vitest.config.ts`, `vitest.setup.ts`, `package.json` scripts added.

- [ ] **Step 1: Bootstrap**

Run inside `c:\HARI\OneLearn`:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias="@/*"
```
Answer prompts: TypeScript=yes, ESLint=yes, Tailwind=yes, App Router=yes, no src dir.

- [ ] **Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install ai @anthropic-ai/sdk
npm install class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 4: Init shadcn/ui**

```bash
npx shadcn@latest init
```
Choose: Default style, Neutral base colour, CSS variables = yes.

Then add components:
```bash
npx shadcn@latest add button card dialog input label select separator badge sheet skeleton toast
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 6: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Add scripts to `package.json`**

In the `"scripts"` block add:
```json
"test": "vitest",
"test:run": "vitest run",
"type-check": "tsc --noEmit"
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js 15 with Tailwind, shadcn, Vitest"
```

---

## Task 2: Supabase Client Setup & Middleware

**Files:**
- Create: `.env.example`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Create `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=
TAVILY_API_KEY=
MATHPIX_APP_ID=
MATHPIX_APP_KEY=
```

Copy to `.env.local` and fill in values from Supabase Dashboard → Project Settings → API.

- [ ] **Step 2: Create `lib/supabase/client.ts`** (browser)

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create `lib/supabase/server.ts`** (server, reads cookies)

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 4: Create `middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = /^\/(login|signup)/.test(request.nextUrl.pathname)
  const isAppRoute = /^\/(dashboard|project)/.test(request.nextUrl.pathname)

  if (!user && isAppRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts middleware.ts .env.example
git commit -m "feat: Supabase client setup and auth middleware"
```

---

## Task 3: TypeScript Database Types

**Files:**
- Create: `lib/supabase/types.ts`

- [ ] **Step 1: Create `lib/supabase/types.ts`**

```ts
export type ResourceType = 'pdf' | 'docx' | 'youtube' | 'url' | 'note'
export type TopicStatus = 'locked' | 'unlocked' | 'done'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
}

export interface Topic {
  id: string
  project_id: string
  name: string
  description: string | null
  status: TopicStatus
  created_at: string
}

export interface TopicEdge {
  parent_id: string
  child_id: string
}

export interface Resource {
  id: string
  project_id: string
  type: ResourceType
  url: string | null
  storage_path: string | null
  label: string
  ingested_at: string | null
  created_at: string
}

export interface ChatMessage {
  id: string
  topic_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface TopicMemory {
  topic_id: string
  summary: string
  updated_at: string
}

export interface AssessmentResult {
  id: string
  topic_id: string
  mode: 'mcq' | 'descriptive'
  score: number
  max_score: number
  created_at: string
}

export interface WrongAnswer {
  id: string
  topic_id: string
  question: string
  user_answer: string
  correct_answer: string
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      projects:           { Row: Project;          Insert: Omit<Project, 'id' | 'created_at'>;          Update: Partial<Omit<Project, 'id'>> }
      topics:             { Row: Topic;            Insert: Omit<Topic, 'id' | 'created_at'>;            Update: Partial<Omit<Topic, 'id'>> }
      topic_edges:        { Row: TopicEdge;        Insert: TopicEdge;                                   Update: TopicEdge }
      resources:          { Row: Resource;         Insert: Omit<Resource, 'id' | 'created_at'>;         Update: Partial<Omit<Resource, 'id'>> }
      chat_messages:      { Row: ChatMessage;      Insert: Omit<ChatMessage, 'id' | 'created_at'>;      Update: never }
      topic_memory:       { Row: TopicMemory;      Insert: TopicMemory;                                 Update: TopicMemory }
      assessment_results: { Row: AssessmentResult; Insert: Omit<AssessmentResult, 'id' | 'created_at'>; Update: never }
      wrong_answers:      { Row: WrongAnswer;      Insert: Omit<WrongAnswer, 'id' | 'created_at'>;      Update: never }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: TypeScript types for all database tables"
```

---

## Task 4: Database Migration

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create `supabase/migrations/001_initial_schema.sql`**

```sql
-- Enable pgvector for RAG embeddings
create extension if not exists vector;

-- Projects
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  description text,
  created_at  timestamptz default now() not null
);
alter table projects enable row level security;
create policy "users own their projects" on projects
  using (auth.uid() = user_id);

-- Topics
create table if not exists topics (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade not null,
  name        text not null,
  description text,
  status      text not null default 'locked' check (status in ('locked','unlocked','done')),
  created_at  timestamptz default now() not null
);
alter table topics enable row level security;
create policy "users access topics via projects" on topics
  using (exists (
    select 1 from projects where projects.id = topics.project_id
      and projects.user_id = auth.uid()
  ));

-- Topic edges (prerequisite DAG)
create table if not exists topic_edges (
  parent_id uuid references topics(id) on delete cascade not null,
  child_id  uuid references topics(id) on delete cascade not null,
  primary key (parent_id, child_id)
);
alter table topic_edges enable row level security;
create policy "users access edges via topics" on topic_edges
  using (exists (
    select 1 from topics t
    join projects p on p.id = t.project_id
    where t.id = topic_edges.parent_id and p.user_id = auth.uid()
  ));

-- Resources
create table if not exists resources (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id) on delete cascade not null,
  type         text not null check (type in ('pdf','docx','youtube','url','note')),
  url          text,
  storage_path text,
  label        text not null,
  ingested_at  timestamptz,
  created_at   timestamptz default now() not null
);
alter table resources enable row level security;
create policy "users access resources via projects" on resources
  using (exists (
    select 1 from projects where projects.id = resources.project_id
      and projects.user_id = auth.uid()
  ));

-- Chat messages
create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid references topics(id) on delete cascade not null,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz default now() not null
);
alter table chat_messages enable row level security;
create policy "users access messages via topics" on chat_messages
  using (exists (
    select 1 from topics t
    join projects p on p.id = t.project_id
    where t.id = chat_messages.topic_id and p.user_id = auth.uid()
  ));

-- Topic memory (compressed session summaries)
create table if not exists topic_memory (
  topic_id   uuid primary key references topics(id) on delete cascade,
  summary    text not null,
  updated_at timestamptz default now() not null
);
alter table topic_memory enable row level security;
create policy "users access memory via topics" on topic_memory
  using (exists (
    select 1 from topics t
    join projects p on p.id = t.project_id
    where t.id = topic_memory.topic_id and p.user_id = auth.uid()
  ));

-- Assessment results
create table if not exists assessment_results (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid references topics(id) on delete cascade not null,
  mode       text not null check (mode in ('mcq','descriptive')),
  score      numeric not null,
  max_score  numeric not null,
  created_at timestamptz default now() not null
);
alter table assessment_results enable row level security;
create policy "users access assessments via topics" on assessment_results
  using (exists (
    select 1 from topics t
    join projects p on p.id = t.project_id
    where t.id = assessment_results.topic_id and p.user_id = auth.uid()
  ));

-- Wrong answers log
create table if not exists wrong_answers (
  id             uuid primary key default gen_random_uuid(),
  topic_id       uuid references topics(id) on delete cascade not null,
  question       text not null,
  user_answer    text not null,
  correct_answer text not null,
  created_at     timestamptz default now() not null
);
alter table wrong_answers enable row level security;
create policy "users access wrong answers via topics" on wrong_answers
  using (exists (
    select 1 from topics t
    join projects p on p.id = t.project_id
    where t.id = wrong_answers.topic_id and p.user_id = auth.uid()
  ));

-- RAG chunk store (pgvector, 1536-dim for text-embedding-3-small)
create table if not exists resource_chunks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade not null,
  resource_id uuid references resources(id) on delete cascade not null,
  chunk_index integer not null,
  content     text not null,
  embedding   vector(1536),
  created_at  timestamptz default now() not null
);
alter table resource_chunks enable row level security;
create policy "users access chunks via projects" on resource_chunks
  using (exists (
    select 1 from projects where projects.id = resource_chunks.project_id
      and projects.user_id = auth.uid()
  ));
create index if not exists resource_chunks_embedding_idx
  on resource_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
```

- [ ] **Step 2: Run migration**

Go to Supabase Dashboard → your project → SQL Editor, paste the SQL above, and click Run.

- [ ] **Step 3: Create Supabase Storage bucket**

In Supabase Dashboard → Storage → New bucket: name it `resources`, set to private.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: initial DB schema with RLS, pgvector, storage bucket"
```

---

## Task 5: DB Query Helpers

**Files:**
- Create: `lib/db/projects.ts`
- Create: `lib/db/topics.ts`
- Create: `lib/db/resources.ts`
- Create: `lib/db/__tests__/projects.test.ts`

- [ ] **Step 1: Write failing test for `getProjects`**

Create `lib/db/__tests__/projects.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockOrder = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockOrder.mockResolvedValue({ data: [], error: null })
  mockSingle.mockResolvedValue({ data: null, error: null })
  mockEq.mockReturnValue({ order: mockOrder, single: mockSingle })
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle })
  mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) })
  mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, delete: mockDelete })
})

describe('getProjects', () => {
  it('returns empty array when no projects exist', async () => {
    const { getProjects } = await import('@/lib/db/projects')
    const result = await getProjects('user-123')
    expect(result).toEqual([])
  })

  it('throws when supabase returns an error', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: new Error('db error') })
    const { getProjects } = await import('@/lib/db/projects')
    await expect(getProjects('user-123')).rejects.toThrow('db error')
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npm run test:run lib/db/__tests__/projects.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/db/projects'`

- [ ] **Step 3: Create `lib/db/projects.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/lib/supabase/types'

export async function getProjects(userId: string): Promise<Project[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function createProject(
  userId: string,
  name: string,
  description?: string
): Promise<Project> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: userId, name, description: description ?? null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Run test — confirm it passes**

```bash
npm run test:run lib/db/__tests__/projects.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: Create `lib/db/topics.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import type { Topic, TopicEdge } from '@/lib/supabase/types'

export async function getTopics(projectId: string): Promise<Topic[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getTopic(id: string): Promise<Topic | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function createTopic(
  projectId: string,
  name: string,
  description?: string
): Promise<Topic> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('topics')
    .insert({ project_id: projectId, name, description: description ?? null, status: 'unlocked' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTopic(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('topics').delete().eq('id', id)
  if (error) throw error
}

export async function updateTopicStatus(id: string, status: Topic['status']): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('topics').update({ status }).eq('id', id)
  if (error) throw error
}

export async function getTopicEdges(topicIds: string[]): Promise<TopicEdge[]> {
  if (topicIds.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('topic_edges')
    .select('*')
    .in('parent_id', topicIds)
  if (error) throw error
  return data ?? []
}

export async function replaceTopicEdges(projectTopicIds: string[], edges: TopicEdge[]): Promise<void> {
  const supabase = await createClient()
  if (projectTopicIds.length > 0) {
    const { error: delErr } = await supabase
      .from('topic_edges')
      .delete()
      .in('parent_id', projectTopicIds)
    if (delErr) throw delErr
  }
  if (edges.length === 0) return
  const { error } = await supabase.from('topic_edges').insert(edges)
  if (error) throw error
}
```

- [ ] **Step 6: Create `lib/db/resources.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import type { Resource } from '@/lib/supabase/types'

export async function getResources(projectId: string): Promise<Resource[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createResource(
  projectId: string,
  label: string,
  type: Resource['type'],
  url?: string,
  storagePath?: string
): Promise<Resource> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('resources')
    .insert({
      project_id: projectId,
      label,
      type,
      url: url ?? null,
      storage_path: storagePath ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteResource(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('resources').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/db/
git commit -m "feat: typed DB helpers for projects, topics, resources"
```

---

## Task 6: Auth Pages

**Files:**
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/signup/page.tsx`
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Create `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OneLearn',
  description: 'AI-powered personalised learning',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create `app/page.tsx`** (root redirect)

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/dashboard' : '/login')
}
```

- [ ] **Step 3: Create `app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/(auth)/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Sign in to OneLearn</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-sm text-muted-foreground">
            No account? <Link href="/signup" className="underline">Create one</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
```

- [ ] **Step 5: Create `app/(auth)/signup/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign up'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account? <Link href="/login" className="underline">Sign in</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
```

- [ ] **Step 6: Create `app/auth/callback/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(`${origin}/dashboard`)
}
```

- [ ] **Step 7: Commit**

```bash
git add app/
git commit -m "feat: auth pages (login, signup) and OAuth callback"
```

---

## Task 7: Authenticated App Shell

**Files:**
- Create: `components/layout/Sidebar.tsx`
- Create: `app/(app)/layout.tsx`

- [ ] **Step 1: Create `components/layout/Sidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, LayoutDashboard, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen border-r bg-muted/40 px-4 py-6 gap-4">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-6 w-6" />
        <span className="font-bold text-lg">OneLearn</span>
      </div>
      <nav className="flex-1 space-y-1">
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
            pathname === '/dashboard' && 'bg-accent font-medium'
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
      </nav>
      <Button variant="ghost" className="justify-start gap-2" onClick={signOut}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </aside>
  )
}
```

- [ ] **Step 2: Create `app/(app)/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/layout.tsx components/layout/
git commit -m "feat: authenticated app shell with sidebar"
```

---

## Task 8: Dashboard — Project List

**Files:**
- Create: `app/api/projects/route.ts`
- Create: `components/project/ProjectCard.tsx`
- Create: `components/project/CreateProjectDialog.tsx`
- Create: `app/(app)/dashboard/page.tsx`
- Create: `app/(app)/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `app/api/projects/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProjects, createProject, deleteProject } from '@/lib/db/projects'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const projects = await getProjects(user.id)
  return NextResponse.json(projects)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, description } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const project = await createProject(user.id, name, description)
  return NextResponse.json(project, { status: 201 })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await deleteProject(id)
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 2: Create `components/project/ProjectCard.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Project } from '@/lib/supabase/types'

interface Props {
  project: Project
  onDelete: (id: string) => void
}

export function ProjectCard({ project, onDelete }: Props) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <Link href={`/project/${project.id}`}>
          <CardTitle className="hover:underline">{project.name}</CardTitle>
        </Link>
        {project.description && <CardDescription>{project.description}</CardDescription>}
      </CardHeader>
      <CardFooter className="justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(project.id)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}
```

- [ ] **Step 3: Create `components/project/CreateProjectDialog.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Project } from '@/lib/supabase/types'

export function CreateProjectDialog({ onCreated }: { onCreated: (p: Project) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    const project = await res.json()
    onCreated(project)
    setName('')
    setDescription('')
    setOpen(false)
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> New Project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create a new project</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="proj-name">Name</Label>
            <Input id="proj-name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="proj-desc">Description (optional)</Label>
            <Input id="proj-desc" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating…' : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Create `app/(app)/dashboard/DashboardClient.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { ProjectCard } from '@/components/project/ProjectCard'
import { CreateProjectDialog } from '@/components/project/CreateProjectDialog'
import type { Project } from '@/lib/supabase/types'

export function DashboardClient({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState(initialProjects)

  async function handleDelete(id: string) {
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
    setProjects(p => p.filter(proj => proj.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <CreateProjectDialog onCreated={p => setProjects(prev => [p, ...prev])} />
      </div>
      {projects.length === 0 ? (
        <p className="text-muted-foreground">No projects yet. Create one to get started.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create `app/(app)/dashboard/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@/lib/db/projects'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const projects = await getProjects(user!.id)
  return <DashboardClient initialProjects={projects} />
}
```

- [ ] **Step 6: Commit**

```bash
git add app/(app)/dashboard/ app/api/projects/ components/project/
git commit -m "feat: dashboard with project list, create, and delete"
```

---

## Task 9: Topic Management

**Files:**
- Create: `app/api/topics/route.ts`
- Create: `components/topic/AddTopicDialog.tsx`
- Create: `components/topic/TopicList.tsx`

- [ ] **Step 1: Create `app/api/topics/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTopics, createTopic, deleteTopic } from '@/lib/db/topics'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  const topics = await getTopics(projectId)
  return NextResponse.json(topics)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId, name, description } = await req.json()
  if (!projectId || !name) return NextResponse.json({ error: 'projectId and name required' }, { status: 400 })
  const topic = await createTopic(projectId, name, description)
  return NextResponse.json(topic, { status: 201 })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await deleteTopic(id)
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 2: Create `components/topic/AddTopicDialog.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Topic } from '@/lib/supabase/types'

interface Props { projectId: string; onAdded: (t: Topic) => void }

export function AddTopicDialog({ projectId, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name, description }),
    })
    const topic = await res.json()
    onAdded(topic)
    setName('')
    setDescription('')
    setOpen(false)
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Add Topic</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a topic</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="topic-name">Topic name</Label>
            <Input id="topic-name" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Linear Algebra" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="topic-desc">Description (optional)</Label>
            <Input id="topic-desc" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Adding…' : 'Add Topic'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Create `components/topic/TopicList.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { Trash2, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { Topic } from '@/lib/supabase/types'

const statusVariant: Record<Topic['status'], 'secondary' | 'default' | 'outline'> = {
  locked: 'secondary',
  unlocked: 'default',
  done: 'outline',
}

interface Props { topics: Topic[]; projectId: string; onDelete: (id: string) => void }

export function TopicList({ topics, projectId, onDelete }: Props) {
  if (topics.length === 0) {
    return <p className="text-muted-foreground">No topics yet. Add one above.</p>
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {topics.map(topic => (
        <Card key={topic.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{topic.name}</CardTitle>
              <Badge variant={statusVariant[topic.status]}>{topic.status}</Badge>
            </div>
            {topic.description && <CardDescription>{topic.description}</CardDescription>}
          </CardHeader>
          <CardFooter className="justify-between">
            <Link href={`/project/${projectId}/topic/${topic.id}`}>
              <Button variant="outline" size="sm">
                <MessageSquare className="mr-2 h-4 w-4" /> Open Chat
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => onDelete(topic.id)}
              className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/topics/ components/topic/
git commit -m "feat: topic management — add, list, delete"
```

---

## Task 10: Resource Management + Project Page Assembly

**Files:**
- Create: `app/api/resources/route.ts`
- Create: `components/resource/AddResourceDialog.tsx`
- Create: `components/resource/ResourceList.tsx`
- Create: `app/(app)/project/[id]/ProjectPageClient.tsx`
- Create: `app/(app)/project/[id]/page.tsx`
- Create: `app/(app)/project/[id]/topic/[topicId]/page.tsx`

- [ ] **Step 1: Create `app/api/resources/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createResource, deleteResource } from '@/lib/db/resources'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const projectId = formData.get('projectId') as string
    const file = formData.get('file') as File
    const type = formData.get('type') as 'pdf' | 'docx'
    const storagePath = `${user.id}/${projectId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('resources')
      .upload(storagePath, file)
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
    const resource = await createResource(projectId, file.name, type, undefined, storagePath)
    return NextResponse.json(resource, { status: 201 })
  }

  const { projectId, label, type, url } = await req.json()
  if (!projectId || !label || !type) {
    return NextResponse.json({ error: 'projectId, label, type required' }, { status: 400 })
  }
  const resource = await createResource(projectId, label, type, url)
  return NextResponse.json(resource, { status: 201 })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await deleteResource(id)
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 2: Create `components/resource/AddResourceDialog.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Resource, ResourceType } from '@/lib/supabase/types'

interface Props { projectId: string; onAdded: (r: Resource) => void }

const FILE_TYPES: ResourceType[] = ['pdf', 'docx']

export function AddResourceDialog({ projectId, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<ResourceType>('youtube')
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const isFileType = FILE_TYPES.includes(type)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    let res: Response
    if (isFileType && file) {
      const form = new FormData()
      form.append('projectId', projectId)
      form.append('type', type)
      form.append('file', file)
      res = await fetch('/api/resources', { method: 'POST', body: form })
    } else {
      res = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, label: label || url, type, url }),
      })
    }
    const resource = await res.json()
    onAdded(resource)
    setUrl(''); setLabel(''); setFile(null); setOpen(false); setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Add Resource</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a resource</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={v => setType(v as ResourceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">YouTube Link</SelectItem>
                <SelectItem value="url">Web URL</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="docx">DOCX</SelectItem>
                <SelectItem value="note">Plain Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isFileType ? (
            <div className="space-y-1">
              <Label>File</Label>
              <Input type="file" accept={type === 'pdf' ? '.pdf' : '.docx'}
                onChange={e => setFile(e.target.files?.[0] ?? null)} required />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label>URL</Label>
                <Input type="url" value={url} onChange={e => setUrl(e.target.value)}
                  placeholder={type === 'youtube' ? 'https://youtube.com/watch?v=…' : 'https://…'} required />
              </div>
              <div className="space-y-1">
                <Label>Label (optional)</Label>
                <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Friendly name" />
              </div>
            </>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Adding…' : 'Add Resource'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Create `components/resource/ResourceList.tsx`**

```tsx
'use client'

import { FileText, Youtube, Link, FileCode, StickyNote, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Resource } from '@/lib/supabase/types'

const TypeIcon: Record<Resource['type'], React.ElementType> = {
  pdf: FileText, docx: FileCode, youtube: Youtube, url: Link, note: StickyNote,
}

interface Props { resources: Resource[]; onDelete: (id: string) => void }

export function ResourceList({ resources, onDelete }: Props) {
  if (resources.length === 0) {
    return <p className="text-muted-foreground">No resources yet. Add PDFs, YouTube links, or URLs.</p>
  }
  return (
    <ul className="space-y-2">
      {resources.map(r => {
        const Icon = TypeIcon[r.type]
        return (
          <li key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">{r.label}</p>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer"
                    className="text-xs text-muted-foreground hover:underline truncate max-w-xs block">
                    {r.url}
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={r.ingested_at ? 'default' : 'secondary'}>
                {r.ingested_at ? 'Indexed' : 'Pending'}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}
                className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 4: Create `app/(app)/project/[id]/ProjectPageClient.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { TopicList } from '@/components/topic/TopicList'
import { AddTopicDialog } from '@/components/topic/AddTopicDialog'
import { ResourceList } from '@/components/resource/ResourceList'
import { AddResourceDialog } from '@/components/resource/AddResourceDialog'
import type { Project, Topic, Resource } from '@/lib/supabase/types'

interface Props { project: Project; initialTopics: Topic[]; initialResources: Resource[] }

export function ProjectPageClient({ project, initialTopics, initialResources }: Props) {
  const [topics, setTopics] = useState(initialTopics)
  const [resources, setResources] = useState(initialResources)

  async function handleDeleteTopic(id: string) {
    await fetch(`/api/topics?id=${id}`, { method: 'DELETE' })
    setTopics(t => t.filter(topic => topic.id !== id))
  }

  async function handleDeleteResource(id: string) {
    await fetch(`/api/resources?id=${id}`, { method: 'DELETE' })
    setResources(r => r.filter(res => res.id !== id))
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-1">{project.name}</h1>
        {project.description && <p className="text-muted-foreground">{project.description}</p>}
      </div>
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Topics</h2>
          <AddTopicDialog projectId={project.id} onAdded={t => setTopics(prev => [...prev, t])} />
        </div>
        <TopicList topics={topics} projectId={project.id} onDelete={handleDeleteTopic} />
      </section>
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Resources</h2>
          <AddResourceDialog projectId={project.id} onAdded={r => setResources(prev => [r, ...prev])} />
        </div>
        <ResourceList resources={resources} onDelete={handleDeleteResource} />
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Create `app/(app)/project/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getProject } from '@/lib/db/projects'
import { getTopics } from '@/lib/db/topics'
import { getResources } from '@/lib/db/resources'
import { ProjectPageClient } from './ProjectPageClient'

interface Props { params: Promise<{ id: string }> }

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  const [project, topics, resources] = await Promise.all([
    getProject(id),
    getTopics(id),
    getResources(id),
  ])
  if (!project) notFound()
  return <ProjectPageClient project={project} initialTopics={topics} initialResources={resources} />
}
```

- [ ] **Step 6: Create placeholder topic chat page `app/(app)/project/[id]/topic/[topicId]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getTopic } from '@/lib/db/topics'

interface Props { params: Promise<{ id: string; topicId: string }> }

export default async function TopicPage({ params }: Props) {
  const { topicId } = await params
  const topic = await getTopic(topicId)
  if (!topic) notFound()
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{topic.name}</h1>
      <p className="text-muted-foreground">Chat interface coming in Plan 4.</p>
    </div>
  )
}
```

- [ ] **Step 7: Run all tests**

```bash
npm run test:run
```
Expected: all PASS.

- [ ] **Step 8: Build check**

```bash
npm run build
```
Expected: zero type errors, successful build.

- [ ] **Step 9: Commit**

```bash
git add app/(app)/project/ app/api/resources/ components/resource/
git commit -m "feat: project page — topic + resource management, chat placeholder"
```

---

## Self-Review

**Spec coverage:**
- [x] Auth (email/password login, signup, signout, OAuth callback) — Tasks 6, 7
- [x] Project CRUD — Tasks 5, 8
- [x] Topic CRUD with status badge (locked/unlocked/done) — Tasks 5, 9
- [x] Resource addition: PDF, DOCX (file upload to Supabase Storage), YouTube, URL, note — Tasks 5, 10
- [x] Full DB schema with RLS, pgvector extension, `resource_chunks` table — Task 4
- [x] TypeScript types for all tables — Task 3
- [x] Route protection middleware — Task 2
- [x] Vitest unit tests for DB helpers — Task 5
- [ ] Knowledge graph / react-flow DAG — **Plan 2**
- [ ] Resource ingestion pipeline (PDF/YouTube → embeddings) — **Plan 3**
- [ ] Topic chat (streaming, RAG, memory, web search) — **Plan 4**
- [ ] MCQ + Descriptive assessment + MathPix OCR — **Plan 5**
- [ ] YouTube deep analysis (frame diff + transcript) — **Plan 6**
- [ ] Summary notes + PDF export — **Plan 6**

**Placeholder scan:** No TBDs, no "implement later" — all code blocks complete.

**Type consistency:** `ProjectPageClient` uses `Topic`, `Resource`, `Project` from `@/lib/supabase/types`. `TopicList` and `ResourceList` receive the same types. `replaceTopicEdges` (topics helper used in Plan 2) takes `string[]` + `TopicEdge[]` — matches `TopicEdge` shape defined in types.
