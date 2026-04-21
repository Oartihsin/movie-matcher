-- Server-side dedup: given an array of TMDB movie IDs, return only
-- the ones the current user has NOT swiped on. Replaces the client-side
-- pattern of downloading all swiped IDs into memory.

CREATE OR REPLACE FUNCTION filter_unswiped_movie_ids(p_movie_ids int[])
RETURNS int[]
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
