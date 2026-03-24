-- Fix infinite recursion in RLS policies
-- The room_members SELECT policy was referencing room_members itself

-- Drop the recursive policies
DROP POLICY IF EXISTS "Members can read their rooms" ON rooms;
DROP POLICY IF EXISTS "Members can see other members" ON room_members;
DROP POLICY IF EXISTS "Members can read swipes in their rooms" ON swipes;

-- Rooms: use a direct user_id check instead of subquery on room_members
CREATE POLICY "Members can read their rooms"
  ON rooms FOR SELECT
  USING (
    created_by = auth.uid()
    OR id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
  );

-- Room members: users can see rows where they are a member (direct check, no self-reference)
CREATE POLICY "Members can see other members"
  ON room_members FOR SELECT
  USING (user_id = auth.uid());

-- Also allow seeing other members in rooms you belong to
-- Use a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = auth.uid()
  );
$$;

-- Replace the simple policy with one that uses the function
DROP POLICY IF EXISTS "Members can see other members" ON room_members;

CREATE POLICY "Members can see other members"
  ON room_members FOR SELECT
  USING (public.is_room_member(room_id));

-- Fix rooms policy to use the function too
DROP POLICY IF EXISTS "Members can read their rooms" ON rooms;

CREATE POLICY "Members can read their rooms"
  ON rooms FOR SELECT
  USING (public.is_room_member(id));

-- Fix swipes policy
CREATE POLICY "Members can read swipes in their rooms"
  ON swipes FOR SELECT
  USING (public.is_room_member(room_id));
