-- Enable pgvector (may already be enabled)
create extension if not exists vector;

-- Resource sections (teacher-created)
create table if not exists classroom_resource_sections (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid references classrooms(id) on delete cascade not null,
  title text not null,
  order_index int not null default 0,
  created_at timestamptz default now()
);
alter table classroom_resource_sections enable row level security;
create policy "members can read sections" on classroom_resource_sections for select
  using (
    exists(select 1 from classrooms c where c.id = classroom_id and c.teacher_id = auth.uid())
    or exists(select 1 from classroom_members m where m.classroom_id = classroom_resource_sections.classroom_id and m.student_id = auth.uid())
  );
create policy "teacher can manage sections" on classroom_resource_sections for all
  using (exists(select 1 from classrooms c where c.id = classroom_id and c.teacher_id = auth.uid()));

-- Resource files
create table if not exists classroom_resource_files (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references classroom_resource_sections(id) on delete cascade not null,
  classroom_id uuid references classrooms(id) on delete cascade not null,
  name text not null,
  type text not null,
  storage_path text,
  url text,
  size_bytes bigint,
  ingested boolean default false,
  created_at timestamptz default now()
);
alter table classroom_resource_files enable row level security;
create policy "members can read files" on classroom_resource_files for select
  using (
    exists(select 1 from classrooms c where c.id = classroom_id and c.teacher_id = auth.uid())
    or exists(select 1 from classroom_members m where m.classroom_id = classroom_resource_files.classroom_id and m.student_id = auth.uid())
  );
create policy "teacher can manage files" on classroom_resource_files for all
  using (exists(select 1 from classrooms c where c.id = classroom_id and c.teacher_id = auth.uid()));

-- Chunks for RAG (shared: user_id null; personal: user_id set)
create table if not exists classroom_resource_chunks (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid references classrooms(id) on delete cascade not null,
  file_id uuid,
  user_id uuid,
  chunk_index int not null default 0,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);
alter table classroom_resource_chunks enable row level security;
create policy "read own or shared chunks" on classroom_resource_chunks for select
  using (
    user_id = auth.uid()
    or (user_id is null and (
      exists(select 1 from classrooms c where c.id = classroom_id and c.teacher_id = auth.uid())
      or exists(select 1 from classroom_members m where m.classroom_id = classroom_resource_chunks.classroom_id and m.student_id = auth.uid())
    ))
  );
create policy "insert own chunks" on classroom_resource_chunks for insert
  with check (user_id = auth.uid() or user_id is null);
create policy "delete own chunks" on classroom_resource_chunks for delete
  using (user_id = auth.uid() or user_id is null);

-- Personal resources (per-user, not shared)
create table if not exists personal_resources (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid references classrooms(id) on delete cascade not null,
  user_id uuid not null,
  name text not null,
  type text not null,
  storage_path text,
  size_bytes bigint,
  ingested boolean default false,
  created_at timestamptz default now()
);
alter table personal_resources enable row level security;
create policy "own personal resources" on personal_resources for all
  using (user_id = auth.uid());

-- OneAI chats
create table if not exists classroom_ai_chats (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid references classrooms(id) on delete cascade not null,
  user_id uuid not null,
  title text not null default 'New Chat',
  created_at timestamptz default now()
);
alter table classroom_ai_chats enable row level security;
create policy "own chats" on classroom_ai_chats for all using (user_id = auth.uid());

-- OneAI messages
create table if not exists classroom_ai_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references classroom_ai_chats(id) on delete cascade not null,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);
alter table classroom_ai_messages enable row level security;
create policy "own messages" on classroom_ai_messages for all
  using (exists(select 1 from classroom_ai_chats c where c.id = chat_id and c.user_id = auth.uid()));

-- Similarity search function
create or replace function match_classroom_chunks(
  query_embedding vector(1536),
  p_classroom_id uuid,
  p_user_id uuid,
  p_file_ids uuid[],
  match_count int default 6
)
returns table(id uuid, content text, similarity float)
language plpgsql
as $$
begin
  return query
  select
    c.id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from classroom_resource_chunks c
  where
    c.classroom_id = p_classroom_id
    and (c.user_id is null or c.user_id = p_user_id)
    and (array_length(p_file_ids, 1) is null or c.file_id = any(p_file_ids))
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;
