-- Phase 2: Connections System
-- Bidirectional connections between users (like friend requests)

-- connections table
CREATE TABLE connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  addressee_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_connections_requester ON connections(requester_id, status);
CREATE INDEX idx_connections_addressee ON connections(addressee_id, status);

-- RLS
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Users can see connections they're part of
CREATE POLICY "Users can view own connections"
  ON connections FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Users can create connection requests
CREATE POLICY "Users can send connection requests"
  ON connections FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Users can update connections they're part of (accept/block)
CREATE POLICY "Users can update own connections"
  ON connections FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Enable realtime for connections
ALTER PUBLICATION supabase_realtime ADD TABLE connections;

-- RPC: Send a connection request (prevents duplicates, handles reverse direction)
CREATE OR REPLACE FUNCTION send_connection_request(p_addressee_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_requester_id uuid := auth.uid();
  v_existing connections;
  v_result connections;
BEGIN
  -- Check not sending to self
  IF v_requester_id = p_addressee_id THEN
    RETURN json_build_object('error', 'Cannot connect with yourself');
  END IF;

  -- Check if connection already exists in either direction
  SELECT * INTO v_existing
  FROM connections
  WHERE (requester_id = v_requester_id AND addressee_id = p_addressee_id)
     OR (requester_id = p_addressee_id AND addressee_id = v_requester_id);

  IF v_existing IS NOT NULL THEN
    IF v_existing.status = 'accepted' THEN
      RETURN json_build_object('error', 'Already connected');
    ELSIF v_existing.status = 'pending' AND v_existing.addressee_id = v_requester_id THEN
      -- They sent us a request — auto-accept
      UPDATE connections
      SET status = 'accepted', updated_at = now()
      WHERE id = v_existing.id
      RETURNING * INTO v_result;
      RETURN row_to_json(v_result);
    ELSIF v_existing.status = 'pending' THEN
      RETURN json_build_object('error', 'Request already sent');
    ELSIF v_existing.status = 'blocked' THEN
      RETURN json_build_object('error', 'Connection blocked');
    END IF;
  END IF;

  -- Create new request
  INSERT INTO connections (requester_id, addressee_id, status)
  VALUES (v_requester_id, p_addressee_id, 'pending')
  RETURNING * INTO v_result;

  RETURN row_to_json(v_result);
END;
$$;

-- RPC: Respond to a connection request (accept or block)
CREATE OR REPLACE FUNCTION respond_to_connection(p_connection_id uuid, p_action text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_connection connections;
  v_result connections;
BEGIN
  IF p_action NOT IN ('accepted', 'blocked') THEN
    RETURN json_build_object('error', 'Invalid action. Use accepted or blocked');
  END IF;

  -- Only the addressee can respond
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

  RETURN row_to_json(v_result);
END;
$$;

-- RPC: Get all connections for the current user with profile info
CREATE OR REPLACE FUNCTION get_connections_for_user()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  RETURN (
    SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        c.id,
        c.requester_id,
        c.addressee_id,
        c.status,
        c.created_at,
        c.updated_at,
        CASE
          WHEN c.requester_id = v_user_id THEN c.addressee_id
          ELSE c.requester_id
        END AS other_user_id,
        p.username AS other_username,
        p.display_name AS other_display_name,
        p.avatar_url AS other_avatar_url
      FROM connections c
      JOIN profiles p ON p.id = CASE
        WHEN c.requester_id = v_user_id THEN c.addressee_id
        ELSE c.requester_id
      END
      WHERE (c.requester_id = v_user_id OR c.addressee_id = v_user_id)
        AND c.status != 'blocked'
      ORDER BY
        CASE WHEN c.status = 'pending' AND c.addressee_id = v_user_id THEN 0 ELSE 1 END,
        c.updated_at DESC
    ) t
  );
END;
$$;

-- RPC: Get pending incoming count (for badge)
CREATE OR REPLACE FUNCTION get_pending_connection_count()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT count(*)::int
  FROM connections
  WHERE addressee_id = auth.uid()
    AND status = 'pending';
$$;
