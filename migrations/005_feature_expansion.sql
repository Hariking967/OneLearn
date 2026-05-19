-- Multiple isolated chat sessions per topic
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL DEFAULT 'Chat 1',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL;

-- Feed
CREATE TABLE IF NOT EXISTS feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid REFERENCES classrooms(id) ON DELETE CASCADE,
  author_id uuid,
  type text NOT NULL CHECK (type IN ('announcement','discussion')),
  title text,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS feed_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES feed_posts(id) ON DELETE CASCADE,
  parent_reply_id uuid REFERENCES feed_replies(id) ON DELETE CASCADE,
  author_id uuid,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Assignment enhancements
ALTER TABLE classroom_assignments ADD COLUMN IF NOT EXISTS auto_correct boolean DEFAULT true;
ALTER TABLE classroom_assignments ADD COLUMN IF NOT EXISTS auto_correct_enabled boolean DEFAULT true;

-- Resource ingest status
ALTER TABLE resources ADD COLUMN IF NOT EXISTS ingest_status text DEFAULT 'pending' CHECK (ingest_status IN ('pending','indexing','done','error'));
ALTER TABLE resources ADD COLUMN IF NOT EXISTS suggested_topic_id uuid REFERENCES topics(id);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS topic_confirmed boolean DEFAULT false;

-- User-defined learning path
ALTER TABLE projects ADD COLUMN IF NOT EXISTS path_mode text DEFAULT 'ai' CHECK (path_mode IN ('ai','custom'));
CREATE TABLE IF NOT EXISTS user_tree_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL,
  description text,
  parent_id uuid REFERENCES user_tree_nodes(id),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
