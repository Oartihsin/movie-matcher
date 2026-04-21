-- Reusable Postgres-based rate limiter for RPC and data operations.
-- No external dependencies — uses a lightweight log table with
-- opportunistic cleanup of stale entries.

CREATE TABLE rate_limit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_lookup
  ON rate_limit_log (user_id, action, created_at DESC);

-- RLS: no direct client access — only called via SECURITY DEFINER function
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max_count int,
  p_window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
  v_window_start timestamptz;
BEGIN
  v_window_start := now() - (p_window_seconds || ' seconds')::interval;

  SELECT count(*) INTO v_count
  FROM rate_limit_log
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at > v_window_start;

  IF v_count >= p_max_count THEN
    RETURN false;
  END IF;

  INSERT INTO rate_limit_log (user_id, action)
  VALUES (p_user_id, p_action);

  -- Opportunistic cleanup: delete stale entries for this user/action
  DELETE FROM rate_limit_log
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at < v_window_start;

  RETURN true;
END;
$$;
