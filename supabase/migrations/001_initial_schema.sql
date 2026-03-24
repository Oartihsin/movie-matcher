-- Movie Matcher: Initial Schema
-- Run this in the Supabase SQL editor

-- Rooms table
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_by uuid REFERENCES auth.users NOT NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed')),
  movie_page int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Room members
CREATE TABLE room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

-- Swipes
CREATE TABLE swipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  tmdb_movie_id int NOT NULL,
  liked boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id, tmdb_movie_id)
);

-- Indexes
CREATE INDEX idx_swipes_room_movie ON swipes(room_id, tmdb_movie_id);
CREATE INDEX idx_swipes_room_user ON swipes(room_id, user_id);
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_room_members_room ON room_members(room_id);
CREATE INDEX idx_room_members_user ON room_members(user_id);

-- Matches view: movies both users liked in a room
CREATE VIEW matches AS
SELECT
  s1.room_id,
  s1.tmdb_movie_id,
  GREATEST(s1.created_at, s2.created_at) AS matched_at
FROM swipes s1
JOIN swipes s2
  ON s1.room_id = s2.room_id
  AND s1.tmdb_movie_id = s2.tmdb_movie_id
  AND s1.user_id != s2.user_id
WHERE s1.liked = true AND s2.liked = true
  AND s1.user_id < s2.user_id; -- avoid duplicate rows

-- Row-Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;

-- Rooms policies
CREATE POLICY "Users can create rooms"
  ON rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can read their rooms"
  ON rooms FOR SELECT
  USING (
    id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Creator can update room"
  ON rooms FOR UPDATE
  USING (created_by = auth.uid());

-- Room members policies
CREATE POLICY "Users can join rooms"
  ON room_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can see other members"
  ON room_members FOR SELECT
  USING (
    room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
  );

-- Swipes policies
CREATE POLICY "Users can insert their own swipes"
  ON swipes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can read swipes in their rooms"
  ON swipes FOR SELECT
  USING (
    room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
  );

-- Enable Realtime on swipes and room_members
-- (Also do this in the Supabase dashboard: Database > Replication)
ALTER PUBLICATION supabase_realtime ADD TABLE swipes;
ALTER PUBLICATION supabase_realtime ADD TABLE room_members;
