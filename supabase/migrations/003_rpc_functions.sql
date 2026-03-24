-- RPC functions to bypass RLS for room create/join operations

-- Create room: inserts room + adds creator as member, returns the room
CREATE OR REPLACE FUNCTION public.create_room(p_code text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room rooms%ROWTYPE;
BEGIN
  INSERT INTO rooms (code, created_by)
  VALUES (p_code, p_user_id)
  RETURNING * INTO v_room;

  INSERT INTO room_members (room_id, user_id)
  VALUES (v_room.id, p_user_id);

  RETURN row_to_json(v_room);
END;
$$;

-- Join room: finds room by code, adds user as member, returns the room
CREATE OR REPLACE FUNCTION public.join_room(p_code text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_member_count int;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM room_members WHERE room_id = v_room.id;

  IF v_member_count >= 2 THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  INSERT INTO room_members (room_id, user_id)
  VALUES (v_room.id, p_user_id)
  ON CONFLICT (room_id, user_id) DO NOTHING;

  UPDATE rooms SET status = 'active' WHERE id = v_room.id;

  -- Refresh room data after update
  SELECT * INTO v_room FROM rooms WHERE id = v_room.id;

  RETURN row_to_json(v_room);
END;
$$;

-- Helper: get room by code (for joiners who can't see rooms via RLS)
CREATE OR REPLACE FUNCTION public.get_room_by_code(p_code text)
RETURNS SETOF rooms
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM rooms WHERE code = p_code;
$$;

-- Helper: get member count for a room
CREATE OR REPLACE FUNCTION public.get_room_member_count(p_room_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM room_members WHERE room_id = p_room_id;
$$;
