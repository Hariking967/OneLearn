import { createClient as createAdmin } from '@supabase/supabase-js'
import { embedText } from './embedder'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function retrieveChunks(
  query: string,
  classroomId: string,
  userId: string,
  fileIds: string[] = [],
  topK = 6
): Promise<{ id: string; content: string; similarity: number }[]> {
  const embedding = await embedText(query)
  const { data, error } = await admin.rpc('match_classroom_chunks', {
    query_embedding: embedding,
    p_classroom_id: classroomId,
    p_user_id: userId,
    p_file_ids: fileIds,
    match_count: topK,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; content: string; similarity: number }[]
}

// Backward-compat shim for node-chat-service which calls getRAGContext(projectId, topicId, limit, query)
export async function getRAGContext(
  _projectId: string,
  _topicId: string,
  _limit = 5,
  _query?: string
): Promise<string> {
  // Legacy callers get an empty context — real retrieval now goes through retrieveChunks
  return ''
}
