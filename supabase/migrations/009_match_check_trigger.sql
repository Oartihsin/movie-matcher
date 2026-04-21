-- Move match-checking from client RPC to a server-side trigger.
-- Fires after INSERT or UPDATE on user_swipes when liked = true.
-- The existing check_matches_for_swipe() RPC handles idempotent
-- insertion into connection_matches (ON CONFLICT DO NOTHING).

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
