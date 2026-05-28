-- Classroom Meet sessions
CREATE TABLE IF NOT EXISTS classroom_meets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid REFERENCES classrooms(id) ON DELETE CASCADE NOT NULL,
  host_id      uuid NOT NULL,
  title        text NOT NULL DEFAULT 'Class Meeting',
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  summary      text,
  started_at   timestamptz DEFAULT now(),
  ended_at     timestamptz
);

-- Individual transcript segments (per speaker, per segment)
CREATE TABLE IF NOT EXISTS meet_transcript_segments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meet_id      uuid REFERENCES classroom_meets(id) ON DELETE CASCADE NOT NULL,
  speaker_id   uuid NOT NULL,
  speaker_name text NOT NULL,
  text         text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- Meet participants (join/leave tracking)
CREATE TABLE IF NOT EXISTS meet_participants (
  meet_id      uuid REFERENCES classroom_meets(id) ON DELETE CASCADE NOT NULL,
  user_id      uuid NOT NULL,
  display_name text NOT NULL,
  joined_at    timestamptz DEFAULT now(),
  left_at      timestamptz,
  PRIMARY KEY (meet_id, user_id)
);

-- Friendships
CREATE TABLE IF NOT EXISTS friendships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  uuid NOT NULL,
  addressee_id  uuid NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at    timestamptz DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

-- RLS: classroom_meets
ALTER TABLE classroom_meets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classroom members view meets" ON classroom_meets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM classrooms WHERE id = classroom_meets.classroom_id AND teacher_id = auth.uid())
    OR EXISTS (SELECT 1 FROM classroom_members WHERE classroom_id = classroom_meets.classroom_id AND student_id = auth.uid())
  );

CREATE POLICY "classroom members start meets" ON classroom_meets
  FOR INSERT WITH CHECK (
    host_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM classrooms WHERE id = classroom_id AND teacher_id = auth.uid())
      OR EXISTS (SELECT 1 FROM classroom_members WHERE classroom_id = classroom_id AND student_id = auth.uid())
    )
  );

CREATE POLICY "host can update meet" ON classroom_meets
  FOR UPDATE USING (host_id = auth.uid());

-- RLS: meet_transcript_segments
ALTER TABLE meet_transcript_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classroom members view segments" ON meet_transcript_segments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classroom_meets cm
      WHERE cm.id = meet_transcript_segments.meet_id
      AND (
        EXISTS (SELECT 1 FROM classrooms WHERE id = cm.classroom_id AND teacher_id = auth.uid())
        OR EXISTS (SELECT 1 FROM classroom_members WHERE classroom_id = cm.classroom_id AND student_id = auth.uid())
      )
    )
  );

CREATE POLICY "participants add segments" ON meet_transcript_segments
  FOR INSERT WITH CHECK (speaker_id = auth.uid());

-- RLS: meet_participants
ALTER TABLE meet_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classroom members view participants" ON meet_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classroom_meets cm
      WHERE cm.id = meet_participants.meet_id
      AND (
        EXISTS (SELECT 1 FROM classrooms WHERE id = cm.classroom_id AND teacher_id = auth.uid())
        OR EXISTS (SELECT 1 FROM classroom_members WHERE classroom_id = cm.classroom_id AND student_id = auth.uid())
      )
    )
  );

CREATE POLICY "users join meets" ON meet_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own participation" ON meet_participants
  FOR UPDATE USING (user_id = auth.uid());

-- RLS: friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own friendships" ON friendships
  FOR SELECT USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE POLICY "users send friend requests" ON friendships
  FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY "users respond to friend requests" ON friendships
  FOR UPDATE USING (addressee_id = auth.uid() OR requester_id = auth.uid());

CREATE POLICY "users delete friendships" ON friendships
  FOR DELETE USING (requester_id = auth.uid() OR addressee_id = auth.uid());
