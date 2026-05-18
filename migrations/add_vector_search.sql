-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a function for semantic search across embeddings
CREATE OR REPLACE FUNCTION search_embeddings(
  query_embedding vector,
  project_id uuid,
  match_limit int DEFAULT 5,
  match_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  chunk_text text,
  source_url text,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wsc.id,
    wsc.chunk_text,
    NULL::text as source_url,
    1 - (wsc.embedding <=> query_embedding) as similarity
  FROM web_search_chunks wsc
  WHERE EXISTS (
    SELECT 1 FROM topics t
    WHERE t.id = wsc.topic_id AND t.project_id = search_embeddings.project_id
  )
  AND 1 - (wsc.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;
