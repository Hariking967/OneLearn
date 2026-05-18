-- pgvector similarity search function
create or replace function search_embeddings(
  query_embedding vector(1536),
  project_id      uuid,
  match_limit     int     default 5,
  match_threshold float   default 0.6
)
returns table (
  id          uuid,
  resource_id uuid,
  chunk_text  text,
  similarity  float,
  source_url  text
)
language sql stable
as $$
  select
    rc.id,
    rc.resource_id,
    rc.content      as chunk_text,
    1 - (rc.embedding <=> query_embedding) as similarity,
    r.url           as source_url
  from resource_chunks rc
  join resources r on r.id = rc.resource_id
  where rc.project_id = search_embeddings.project_id
    and 1 - (rc.embedding <=> query_embedding) >= match_threshold
  order by rc.embedding <=> query_embedding
  limit match_limit;
$$;

-- Saved test sessions (MCQ + Descriptive)
create table if not exists test_sessions (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid references topics(id) on delete cascade not null,
  mode         text not null check (mode in ('mcq','descriptive')),
  difficulty   text not null default 'medium',
  questions    jsonb not null,
  answers      jsonb,
  score        numeric,
  max_score    numeric,
  review       text,
  created_at   timestamptz default now() not null,
  submitted_at timestamptz
);
alter table test_sessions enable row level security;
create policy "users access tests via topics" on test_sessions
  using (exists (
    select 1 from topics t join projects p on p.id = t.project_id
    where t.id = test_sessions.topic_id and p.user_id = auth.uid()
  ));
