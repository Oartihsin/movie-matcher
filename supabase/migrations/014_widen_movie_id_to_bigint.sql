-- TMDB movie IDs can exceed int4 range (2,147,483,647).
-- Widen all tmdb_movie_id columns and RPC parameters to bigint.

-- Step 1: Drop trigger that depends on check_matches_for_swipe
DROP TRIGGER IF EXISTS trg_check_matches_after_swipe ON user_swipes;
DROP FUNCTION IF EXISTS trigger_check_matches();

-- Step 2: Drop all functions whose signatures change (parameter or return type)
DROP FUNCTION IF EXISTS filter_unswiped_movie_ids(int[]);
DROP FUNCTION IF EXISTS check_matches_for_swipe(uuid, int);
DROP FUNCTION IF EXISTS get_matches_for_connection(uuid);
DROP FUNCTION IF EXISTS get_swiped_movie_ids(uuid);

-- Step 3: Widen columns
ALTER TABLE user_swipes ALTER COLUMN tmdb_movie_id TYPE bigint;
ALTER TABLE connection_matches ALTER COLUMN tmdb_movie_id TYPE bigint;

-- Step 4: Recreate all functions with bigint

CREATE OR REPLACE FUNCTION filter_unswiped_movie_ids(p_movie_ids bigint[])
RETURNS bigint[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    array_agg(mid),
    '{}'
  )
  FROM unnest(p_movie_ids) AS mid
  WHERE mid NOT IN (
    SELECT tmdb_movie_id
    FROM user_swipes
    WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION check_matches_for_swipe(p_user_id uuid, p_movie_id bigint)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_count int := 0;
  v_conn RECORD;
  v_lock_key bigint;
BEGIN
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
    v_lock_key := hashtext(v_conn.connection_id::text || p_movie_id::text);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    IF EXISTS (
      SELECT 1 FROM user_swipes
      WHERE user_id = v_conn.other_user_id
        AND tmdb_movie_id = p_movie_id
        AND liked = true
    ) THEN
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

CREATE OR REPLACE FUNCTION get_matches_for_connection(p_connection_id uuid)
RETURNS TABLE(tmdb_movie_id bigint, matched_at timestamptz)
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

CREATE OR REPLACE FUNCTION get_swiped_movie_ids(p_user_id uuid)
RETURNS bigint[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(tmdb_movie_id), '{}')
  FROM user_swipes
  WHERE user_id = p_user_id;
$$;

-- Step 5: Recreate trigger
CREATE OR REPLACE FUNCTION trigger_check_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.liked = true THEN
    PERFORM check_matches_for_swipe(NEW.user_id, NEW.tmdb_movie_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_matches_after_swipe
  AFTER INSERT OR UPDATE OF liked ON user_swipes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_matches();
