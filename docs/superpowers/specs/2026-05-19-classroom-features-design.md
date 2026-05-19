# OneLearn — Classroom & Project Feature Expansion
**Date:** 2026-05-19  
**Status:** Approved

---

## Overview

Expand OneLearn with: classroom restructure (tabs + Feed), assignment AI generation + auto-correct, report per test, file view for projects, multiple chats per topic, user-defined learning paths, project-level test generation, collapsible resources panel in chat, and a full RAG fix with auto-indexing.

---

## Implementation Strategy

Three parallel tracks executed sequentially by priority:

- **Track 1 — Core/DB (first):** DB migrations, RAG fix, auto-index, AI topic segregation  
- **Track 2 — Classroom (after Track 1 migrations):** Tab restructure, Feed, Assignment enhancements, Report button  
- **Track 3 — Project (parallel with Track 2):** File view, multi-chat, tree builder, generate test, resources panel fix  

---

## Database Schema Changes

```sql
-- Multiple isolated chat sessions per topic
CREATE TABLE chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL DEFAULT 'Chat 1',
  created_at timestamptz DEFAULT now()
);
-- Add session_id to chat_messages (nullable for backwards compat; migration creates default sessions)
ALTER TABLE chat_messages ADD COLUMN session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL;
-- Migration: for each (topic_id, user_id) combo with existing messages, create one default session and backfill session_id

-- Feed: announcements + threaded discussions
CREATE TABLE feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid REFERENCES classrooms(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('announcement', 'discussion')),
  title text,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE feed_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES feed_posts(id) ON DELETE CASCADE,
  parent_reply_id uuid REFERENCES feed_replies(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Assignment auto-correct toggle + teacher override
ALTER TABLE classroom_assignments
  ADD COLUMN auto_correct boolean DEFAULT true,
  ADD COLUMN teacher_override_enabled boolean DEFAULT true;

-- Resource topic suggestion
ALTER TABLE resources
  ADD COLUMN suggested_topic_id uuid REFERENCES topics(id),
  ADD COLUMN topic_confirmed boolean DEFAULT false,
  ADD COLUMN ingest_status text DEFAULT 'pending' CHECK (ingest_status IN ('pending', 'indexing', 'done', 'error'));

-- User-defined learning path (alternative to AI tree)
CREATE TABLE user_tree_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  description text,
  parent_id uuid REFERENCES user_tree_nodes(id),
  level int NOT NULL DEFAULT 0,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
-- Track whether project uses AI path or user path
ALTER TABLE projects
  ADD COLUMN path_mode text DEFAULT 'ai' CHECK (path_mode IN ('ai', 'custom'));
```

**RLS:** All new tables inherit project/classroom isolation policies. `feed_posts` with type `announcement` enforces `author_id` must be classroom teacher in policy.

---

## Section 1 — Classroom Page Restructure

### Tab Layout (Tab A — existing style)
Current: Projects / Assignments / Members / Report  
New: **Projects / Assignments / Students / Feed**  
- Report tab removed. Report is a per-assignment button (teacher/creator only).

### Projects Tab
- "New Project" button creates a project with `classroom_id` set at creation time (no need to assign separately after).
- Project cards show File View (card grid, C) by default with a toggle to Tree View.
- File View: topic cards showing name, status badge (locked / unlocked / done), resource count. Click → topic page.

### Assignments Tab
- Assignment list rows show a **Report** button on the right — visible only to the classroom creator/teacher.
- Report modal shows: score distribution chart, per-student scores table, per-question analytics, average score, hardest/easiest question, AI-generated insight summary (e.g. "Most students struggled with AVL Rotations").
- **Create Assignment** dialog is a 3-step wizard:
  1. Title + description + deadline
  2. Topic selection: checkboxes from project topic tree (primary) OR free-form text input tab
  3. Format (MCQ / Descriptive / Both) + auto-correct toggle + teacher override toggle
- **AI Generate** button in step 2: calls Claude with selected topics → generates questions automatically.
- **Auto-correct:** if enabled, AI grades descriptive submissions on submit via image evaluation pipeline. Teacher can review and override any score afterward. Teacher can also disable auto-correct at classroom-settings level.

### Students Tab
- Renamed from "Members". Same functionality (add by email, remove, list).

### Feed Tab
Two stacked sections:

**Announcements** (top)
- Teacher/admin only can post. Students see but cannot post.
- Pinned style — distinct background, bold title.
- Most recent on top.

**Discussions** (below)
- Teachers and students can both post.
- Threaded replies: each post shows top-level replies; click "Reply" on any reply to nest one level deeper.
- Collapse/expand thread inline.
- Timestamps + author names shown.

---

## Section 2 — Project Page Changes

### View Toggle
Top-right of project page: **Tree View** ↔ **File View** toggle button.
- **Tree View:** existing react-flow graph (no changes).
- **File View:** card grid of all topics. Cards show: topic name, status badge (color-coded: purple=locked, blue=unlocked, green=done), resource count badge, "Open" button → navigates to topic page. Data source: `user_tree_nodes` if `path_mode = 'custom'`, otherwise topics from the AI-generated tree (`topics` table).

### Multiple Chats Per Topic
- Topic chat page gets a **chat session selector** at the top: dropdown or horizontal tab strip showing session names ("Chat 1", "Chat 2", …).
- **"+ New Chat"** button creates a new isolated session (prompts for name, defaults to "Chat N").
- **Delete** button (trash icon) per session with confirmation dialog.
- Sessions are fully isolated: own message history, no shared memory between sessions.
- RAG from project resources applies equally to all sessions.
- `session_id` stored in chat_messages to scope history.

### Resources Panel in Chat
- Right-side panel inside the chat view, containing the ResourceList component.
- **Default:** open on desktop (≥1024px), collapsed on mobile.
- Toggle via chevron/arrow button at top-right of chat layout.
- Fix current overflow bug: resources list is constrained to panel height with internal scroll.
- Panel persists open/closed state in localStorage per user.

### Generate Test (Project Level)
- **"Generate Test"** button in project header toolbar.
- Dialog (2-step):
  1. Select topics (checkboxes from topic tree) OR switch to "Custom Topics" tab for free-form input. Format: MCQ / Descriptive / Both.
  2. Review: toggle **"Convert to Classroom Assignment"** (shows classroom selector if toggled). Default: personal practice quiz.
- Calls `/api/project/[id]/generate-test` (new route) which internally reuses the same question generation logic as classroom assignments (Claude prompt with topic context). Personal quiz results are stored in `assessment_results` scoped to the user; if converted to assignment, stored in `classroom_assignments`.

### User Build Their Own Tree
- **At project creation:** after name + main topic, a choice step: "Let AI build my learning path" (default) vs "I'll define my own path".
- **If own path chosen:** type-in form — add topics one by one with a "Parent topic" dropdown (selects from already-added topics). `path_mode = 'custom'`. Topics saved to `user_tree_nodes`.
- **Later editing:** "Edit Path" button on project page (always visible). Opens same form pre-populated.
- **If AI path:** existing tree generation flow unchanged. `path_mode = 'ai'`.
- Custom path renders in both Tree View (built from `user_tree_nodes` as a react-flow graph) and File View (card grid from same data).

---

## Section 3 — RAG Fix + Auto-Index

### Root Cause
Resources are uploaded and stored in Supabase Storage but the ingestion pipeline (`/api/project/[id]/ingest`) must be manually triggered. Until triggered, no chunks exist in the vector store, so the retriever returns 0 results and the AI has no resource context.

### Fix
1. **Remove manual "Index Resource" button** from the UI.
2. **Auto-trigger ingestion** inside the upload route (`POST /api/project/[id]/resources/upload`) immediately after the file is stored. The ingestion runs as a background promise (fire-and-forget within the request, or via a Supabase Edge Function). Set `ingest_status = 'indexing'` on the resource row immediately.
3. **Status badge** on ResourceList card: "Indexing…" spinner while `ingest_status = 'indexing'`; green checkmark when `done`; red warning icon if `error`.
4. **Retriever fix:** add debug logging when 0 chunks are returned. Verify `project_id` scoping in the vector search query.
5. **Context injection:** ensure the chat route reads retrieved chunks and injects them into the system prompt before the user message.

### AI Topic Segregation
- After ingestion completes, call Claude with the resource content summary → classify which topic(s) it belongs to → write `suggested_topic_id` on the resource row.
- `ResourceList` shows the suggested topic as a badge with "Confirm" and "Change" buttons.
- If confirmed, `topic_confirmed = true`. If teacher has disabled topic auto-suggest in classroom settings, skip this step.
- Chat retriever optionally filters by `suggested_topic_id` to improve relevance (but falls back to project-wide search if no confirmed assignment).

---

## Component & API Changes Summary

### New API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/topic/[id]/chat-sessions` | GET, POST | List / create chat sessions |
| `/api/topic/[id]/chat-sessions/[sessionId]` | DELETE | Delete a session |
| `/api/classrooms/[id]/feed` | GET | List feed posts |
| `/api/classrooms/[id]/feed` | POST | Create announcement or discussion |
| `/api/classrooms/[id]/feed/[postId]/replies` | GET, POST | Thread replies |
| `/api/classrooms/[id]/assignments/[id]/report` | GET | Assignment report data |
| `/api/project/[id]/user-tree` | GET, POST, PUT | User-defined tree CRUD |
| `/api/project/[id]/generate-test` | POST | Project-level test generation |

### Modified API Routes
| Route | Change |
|---|---|
| `/api/project/[id]/resources/upload` | Auto-trigger ingestion after upload |
| `/api/topic/[id]/chat` | Scope messages to `session_id`; fix RAG injection |
| `/api/classrooms/[id]/assignments` | Add `auto_correct`, `teacher_override_enabled` fields |

### New / Modified Components
| Component | Change |
|---|---|
| `ClassroomPageClient.tsx` | Rename tabs; add Feed tab; remove Report tab |
| `FeedTab.tsx` | New: announcements + threaded discussions |
| `AssignmentCreatorDialog.tsx` | 3-step wizard + AI generate + auto-correct toggle |
| `AssignmentReportDialog.tsx` | New: per-test report modal (teacher only) |
| `ProjectPageClient.tsx` | Add view toggle; generate test button; edit path button |
| `FileView.tsx` | New: card grid topic view |
| `TopicChatPage.tsx` | Add session selector + new/delete session |
| `ChatLayout.tsx` | Add collapsible right-side resources panel |
| `ResourceList.tsx` | Add ingest status badge; topic suggestion confirm UI |
| `UserTreeBuilder.tsx` | New: type-in hierarchical topic builder |
| `ProjectCreationDialog.tsx` | Add path mode choice step |

---

## Design Constraints
- Maintain current dark theme (background: `#0f0f13`, surface: `#1e1e2e`, accent: `#6366f1`).
- Maintain current font and spacing conventions (Tailwind classes).
- No new dependencies unless strictly necessary.
- All new DB changes behind RLS policies.
- Mobile-responsive: resources panel collapses, chat sessions use dropdown (not tab strip) on mobile.
