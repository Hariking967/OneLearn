# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OneLearn** is an AI-powered personalised learning platform built with Next.js. Users add topics and learning resources; the AI generates a prerequisite knowledge graph, and each topic gets its own isolated chat with memory. Resources are shared across all topic chats.

## Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **AI/LLM**: Anthropic Claude API (streaming, tool use)
- **Vector DB / RAG**: (choose one: Pinecone / pgvector on Supabase)
- **Database**: Supabase (Postgres) — users, projects, topics, chat history, wrong answers
- **File storage**: Supabase Storage — uploaded PDFs, DOCX, images
- **Auth**: Supabase Auth
- **PDF generation**: `@react-pdf/renderer` or `puppeteer` for summary exports
- **YouTube transcripts**: `youtube-transcript` npm package (fetches CC captions)
- **Math OCR**: pix2tex (LaTeX-OCR) — local Python API server on port 8502
- **Web search**: Tavily API (per-chat tool)
- **Styling**: Tailwind CSS + shadcn/ui

## Core Architecture

### Knowledge Graph

When a user adds topics to a project, Claude analyses them and produces a **DAG (Directed Acyclic Graph)** where each edge `A → B` means "learn A before B". This graph is stored in the `topic_edges` table. The frontend renders it as an interactive graph (react-flow). Topic nodes are unlocked only when all prerequisite topics are completed.

### Resource Ingestion Pipeline (`/lib/ingest/`)

All resources are pre-processed and chunked into a vector store keyed by `project_id`:

- **PDF / DOCX** → extract text (pdf-parse / mammoth) → chunk → embed → upsert
- **YouTube URL** → fetch CC transcript → chunk by time segments → embed → upsert
- **Plain notes** → chunk → embed → upsert

Each chunk stores `{project_id, topic_id?, source_url, chunk_index, text}`.

### Topic Chat (`/app/project/[id]/topic/[topicId]/chat/`)

Each topic has one chat thread. The chat context includes:

1. The topic's own message history (stored per `topic_id`)
2. RAG retrieval from **all project resources** (not scoped to one topic)
3. A persistent `topicMemory` summary that compresses prior sessions
4. Web search tool (Tavily) available on every message

### YouTube Deep Analysis (`/lib/youtube/`)

When a user triggers "Analyse Video":

1. Fetch CC transcript with timestamps
2. Extract video frames at regular intervals and compute frame-diff scores
3. Frames where diff > threshold are saved as "slide keyframes"
4. Each keyframe is paired with the transcript segment active at that timestamp
5. Result: a structured list of `{timestamp, slide_image_url, transcript_segment}` rendered as a scrollable timeline

### Assessment Tools (per topic chat)

**MCQ mode**

- Claude generates N multiple-choice questions from chat/resource context
- Frontend renders a card-based 4-option quiz UI
- Results stored in `assessment_results`; wrong questions logged to `wrong_answers`

**Descriptive mode**

- Claude generates open-ended questions
- User writes/uploads handwritten answers; pix2tex OCR extracts structured LaTeX
- Claude evaluates extracted answers against the questions and returns a score + per-question review
- Wrong/low-scoring questions logged to `wrong_answers`

### Summary Notes & PDF Export

- **Topic summary**: Claude summarises the full chat for a topic → rendered as markdown → exported as PDF
- **Project summary**: Aggregates all topic summaries into one PDF
- Endpoint: `POST /api/project/[id]/summary` (accepts `scope: 'topic' | 'project'`, `topicId?`)

## Key Data Model (Supabase)

```sql
projects(id, user_id, name, created_at)
topics(id, project_id, name, description, status) -- status: locked|unlocked|done
topic_edges(parent_id, child_id)                  -- DAG edges
resources(id, project_id, type, url, storage_path, ingested_at)
chat_messages(id, topic_id, role, content, created_at)
topic_memory(topic_id, summary, updated_at)        -- compressed session memory
assessment_results(id, topic_id, mode, score, created_at)
wrong_answers(id, topic_id, question, user_answer, correct_answer, created_at)
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
TAVILY_API_KEY=
PIX2TEX_API_URL=          # pix2tex local server, default http://localhost:8502
YOUTUBE_API_KEY=          # only needed if using Data API; transcript fetch is keyless
VECTOR_DB_URL=            # Pinecone or pgvector connection string
```

## Phase 2: Tree-Based Knowledge Graph & AI Chat (Latest)

**Knowledge Graph:** Simplified from DAG to **tree structure** (parent_id + level fields). Leaves are foundational concepts, root is the target topic. DeepSeek generates hierarchical prerequisites via OpenRouter API.

**Chat System:** Per-node isolated chats with context from all child nodes, RAG-embedded project resources, persistent memory across sessions. Tools: MCQ generation from node concepts, Tavily web search.

**RAG Pipeline:** pgvector semantic search with chunked embeddings. Resources stored in Supabase Storage per project. Chunks embed via Anthropic API (1536-dim vectors).

**API Changes:**
- `/api/generate-graph` — generates tree from topic using DeepSeek (OpenRouter)
- `/api/project/[id]/generate-tree` — retrieves stored tree
- `/api/topic/[id]/chat` — streaming chat with tool support
- `/api/project/[id]/resources/upload` — file upload to S3-like storage

**DeepSeek Integration:** All AI ops use DeepSeek via OpenRouter with fallback support. Streaming enabled, tool calling for MCQ and web search. 15-second timeout with proper error handling.

**New Modules:** `lib/graph/tree-generator.ts`, `lib/chat/node-chat-service.ts`, `lib/rag/chunker.ts`, embedder, retriever. Full TypeScript typing, RLS policies for project isolation.

## Conventions

- All LLM calls use DeepSeek via OpenRouter (`/lib/ai/deepseek-client.ts`)
- Streaming responses via `deepseekStreamText()` pattern
- RAG retrieval always scopes by `project_id`; never leaks chunks
- Tree regenerated (not patched) when topics change; idempotent upsert
