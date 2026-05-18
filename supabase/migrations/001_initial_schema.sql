-- Enable pgvector
create extension if not exists vector;

-- Projects (main_topic added for graph generation)
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  description text,
  main_topic  text,
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
  status      text not null default 'unlocked' check (status in ('locked','unlocked','done')),
  created_at  timestamptz default now() not null
);
alter table topics enable row level security;
create policy "users access topics via projects" on topics
  using (exists (
    select 1 from projects where projects.id = topics.project_id
      and projects.user_id = auth.uid()
  ));

-- Topic prerequisite edges (DAG)
create table if not exists topic_edges (
  parent_id uuid references topics(id) on delete cascade not null,
  child_id  uuid references topics(id) on delete cascade not null,
  primary key (parent_id, child_id)
);
alter table topic_edges enable row level security;
create policy "users access edges via topics" on topic_edges
  using (exists (
    select 1 from topics t join projects p on p.id = t.project_id
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
    select 1 from topics t join projects p on p.id = t.project_id
    where t.id = chat_messages.topic_id and p.user_id = auth.uid()
  ));

-- Topic memory
create table if not exists topic_memory (
  topic_id   uuid primary key references topics(id) on delete cascade,
  summary    text not null,
  updated_at timestamptz default now() not null
);
alter table topic_memory enable row level security;
create policy "users access memory via topics" on topic_memory
  using (exists (
    select 1 from topics t join projects p on p.id = t.project_id
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
    select 1 from topics t join projects p on p.id = t.project_id
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
    select 1 from topics t join projects p on p.id = t.project_id
    where t.id = wrong_answers.topic_id and p.user_id = auth.uid()
  ));

-- RAG chunks (pgvector)
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
