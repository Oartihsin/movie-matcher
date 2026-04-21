-- Fix race condition: two connected users swiping on the same movie
-- concurrently could both miss the match because neither transaction
-- can see the other's uncommitted row.
--
-- Solution: acquire a transaction-scoped advisory lock keyed on
-- (connection_id, movie_id) before checking. The second transaction
-- blocks until the first commits, then sees the committed row.

CREATE OR REPLACE FUNCTION check_matches_for_swipe(p_user_id uuid, p_movie_id int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_count int := 0;
  v_conn RECORD;
  v_lock_key bigint;
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
    -- Serialize concurrent match checks for the same (connection, movie)
    v_lock_key := hashtext(v_conn.connection_id::text || p_movie_id::text);
    PERFORM pg_advisory_xact_lock(v_lock_key);

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
