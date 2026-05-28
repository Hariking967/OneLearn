-- Fix 2: Add FK on classroom_resource_chunks.file_id
-- (table is new/empty so constraint can be added safely)
alter table classroom_resource_chunks
  add constraint classroom_resource_chunks_file_id_fkey
  foreign key (file_id) references classroom_resource_files(id) on delete cascade;

-- Fix 3a: Add auth.users FK on personal_resources.user_id
alter table personal_resources
  add constraint personal_resources_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- Fix 3b: Add auth.users FK on classroom_ai_chats.user_id
alter table classroom_ai_chats
  add constraint classroom_ai_chats_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- Fix 1: Add HNSW index on embedding (preferred over IVFFlat for sparse tables)
create index if not exists classroom_resource_chunks_embedding_idx
  on classroom_resource_chunks using hnsw (embedding vector_cosine_ops);

-- Fix 4: Replace insecure delete policy with one that also allows teacher to delete shared chunks
drop policy if exists "delete own chunks" on classroom_resource_chunks;
create policy "delete own or teacher chunks" on classroom_resource_chunks for delete
  using (
    user_id = auth.uid()
    or (user_id is null and exists(
      select 1 from classrooms c where c.id = classroom_id and c.teacher_id = auth.uid()
    ))
  );
