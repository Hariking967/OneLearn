-- Add tree structure to topics table
ALTER TABLE topics ADD COLUMN parent_id UUID REFERENCES topics(id) ON DELETE CASCADE;
ALTER TABLE topics ADD COLUMN level INTEGER DEFAULT 0;

-- Create index on parent_id for efficient tree traversal
CREATE INDEX idx_topics_parent_id ON topics(parent_id);
CREATE INDEX idx_topics_level_project_id ON topics(project_id, level);

-- Drop the old topic_edges table if it exists (DAG structure)
DROP TABLE IF EXISTS topic_edges CASCADE;

-- Create node_chat_messages table for per-node conversations
CREATE TABLE IF NOT EXISTS node_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_node_chat_topic_id ON node_chat_messages(topic_id);
CREATE INDEX idx_node_chat_created_at ON node_chat_messages(created_at DESC);

-- Create node_memory table for session summaries
CREATE TABLE IF NOT EXISTS node_memory (
  topic_id UUID PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
  memory_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create web_search_chunks table for embedded search results
CREATE TABLE IF NOT EXISTS web_search_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  search_query TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_web_search_topic_id ON web_search_chunks(topic_id);
CREATE INDEX idx_web_search_query ON web_search_chunks(search_query);

-- Add RLS policies for security
ALTER TABLE node_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_search_chunks ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see chat for their own projects
CREATE POLICY node_chat_select_policy ON node_chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM topics
      WHERE topics.id = node_chat_messages.topic_id
      AND topics.project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY node_chat_insert_policy ON node_chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM topics
      WHERE topics.id = node_chat_messages.topic_id
      AND topics.project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

-- RLS policy for node_memory
CREATE POLICY node_memory_select_policy ON node_memory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM topics
      WHERE topics.id = node_memory.topic_id
      AND topics.project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY node_memory_insert_policy ON node_memory FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM topics
      WHERE topics.id = node_memory.topic_id
      AND topics.project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

-- RLS policy for web_search_chunks
CREATE POLICY web_search_select_policy ON web_search_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM topics
      WHERE topics.id = web_search_chunks.topic_id
      AND topics.project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY web_search_insert_policy ON web_search_chunks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM topics
      WHERE topics.id = web_search_chunks.topic_id
      AND topics.project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );
