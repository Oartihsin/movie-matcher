-- Phase 3: Per-Connection Match Detection
-- Matches are materialized per-connection for fast lookups

CREATE TABLE connection_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES connections ON DELETE CASCADE NOT NULL,
  tmdb_movie_id int NOT NULL,
  matched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, tmdb_movie_id)
);

CREATE INDEX idx_connection_matches_connection ON connection_matches(connection_id);

-- RLS
ALTER TABLE connection_matches ENABLE ROW LEVEL SECURITY;

-- Users can see matches for connections they're part of
CREATE POLICY "Users can view own connection matches"
  ON connection_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM connections c
      WHERE c.id = connection_matches.connection_id
        AND (c.requester_id = auth.uid() OR c.addressee_id = auth.uid())
        AND c.status = 'accepted'
    )
  );

-- Enable realtime for match notifications
ALTER PUBLICATION supabase_realtime ADD TABLE connection_matches;

-- RPC: Check matches after a user likes a movie
-- Looks at all accepted connections and checks if the other user also liked this movie
CREATE OR REPLACE FUNCTION check_matches_for_swipe(p_user_id uuid, p_movie_id int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_count int := 0;
  v_conn RECORD;
BEGIN
  -- Find all accepted connections for this user
  FOR v_conn IN
    SELECT c.id AS connection_id,
      CASE
        WHEN c.requester_id = p_user_id THEN c.addressee_id
        ELSE c.requester_id
      END AS other_user_id
    FROM connections c
    WHERE (c.requester_id = p_user_id OR c.addressee_id = p_user_id)
      AND c.status = 'accepted'
  LOOP
    -- Check if the other user also liked this movie
    IF EXISTS (
      SELECT 1 FROM user_swipes
      WHERE user_id = v_conn.other_user_id
        AND tmdb_movie_id = p_movie_id
        AND liked = true
    ) THEN
      -- Insert match (ignore if already exists)
      INSERT INTO connection_matches (connection_id, tmdb_movie_id)
      VALUES (v_conn.connection_id, p_movie_id)
      ON CONFLICT (connection_id, tmdb_movie_id) DO NOTHING;

      IF FOUND THEN
        v_match_count := v_match_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_match_count;
END;
$$;

-- RPC: Backfill matches when a connection is accepted
-- Finds all overlapping likes between two users
CREATE OR REPLACE FUNCTION backfill_matches_for_connection(p_connection_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conn connections;
  v_match_count int;
BEGIN
  SELECT * INTO v_conn
  FROM connections
  WHERE id = p_connection_id
    AND status = 'accepted';

  IF v_conn IS NULL THEN
    RETURN 0;
  END IF;

  -- Find movies both users liked and insert as matches
  WITH new_matches AS (
    INSERT INTO connection_matches (connection_id, tmdb_movie_id)
    SELECT p_connection_id, s1.tmdb_movie_id
    FROM user_swipes s1
    JOIN user_swipes s2 ON s1.tmdb_movie_id = s2.tmdb_movie_id
    WHERE s1.user_id = v_conn.requester_id
      AND s2.user_id = v_conn.addressee_id
      AND s1.liked = true
      AND s2.liked = true
    ON CONFLICT (connection_id, tmdb_movie_id) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_match_count FROM new_matches;

  RETURN v_match_count;
END;
$$;

-- RPC: Get matches for a specific connection with movie IDs
CREATE OR REPLACE FUNCTION get_matches_for_connection(p_connection_id uuid)
RETURNS TABLE(tmdb_movie_id int, matched_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT cm.tmdb_movie_id, cm.matched_at
  FROM connection_matches cm
  JOIN connections c ON c.id = cm.connection_id
  WHERE cm.connection_id = p_connection_id
    AND (c.requester_id = auth.uid() OR c.addressee_id = auth.uid())
    AND c.status = 'accepted'
  ORDER BY cm.matched_at DESC;
$$;

-- RPC: Get match counts per connection (for badge display)
CREATE OR REPLACE FUNCTION get_match_counts()
RETURNS TABLE(connection_id uuid, match_count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT cm.connection_id, count(*) AS match_count
  FROM connection_matches cm
  JOIN connections c ON c.id = cm.connection_id
  WHERE (c.requester_id = auth.uid() OR c.addressee_id = auth.uid())
    AND c.status = 'accepted'
  GROUP BY cm.connection_id;
$$;

-- Update respond_to_connection to trigger backfill on accept
CREATE OR REPLACE FUNCTION respond_to_connection(p_connection_id uuid, p_action text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_connection connections;
  v_result connections;
  v_backfill_count int;
BEGIN
  IF p_action NOT IN ('accepted', 'blocked') THEN
    RETURN json_build_object('error', 'Invalid action. Use accepted or blocked');
  END IF;

  SELECT * INTO v_connection
  FROM connections
  WHERE id = p_connection_id
    AND addressee_id = auth.uid()
    AND status = 'pending';

  IF v_connection IS NULL THEN
    RETURN json_build_object('error', 'Connection request not found');
  END IF;

  UPDATE connections
  SET status = p_action, updated_at = now()
  WHERE id = p_connection_id
  RETURNING * INTO v_result;

  -- Backfill matches if accepted
  IF p_action = 'accepted' THEN
    v_backfill_count := backfill_matches_for_connection(p_connection_id);
  END IF;

  RETURN row_to_json(v_result);
END;
$$;
