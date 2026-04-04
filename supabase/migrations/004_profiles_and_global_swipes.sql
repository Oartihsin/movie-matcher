-- Movie Matcher: Profiles + Global Swipes (Connection Model Phase 1)
-- Run this in the Supabase SQL editor
-- Old tables (rooms, room_members, swipes) are kept for backward compatibility until Phase 5.

-- ============================================================
-- 1. Profiles table
-- ============================================================
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  phone_verified boolean NOT NULL DEFAULT false,
  preferred_genres int[] DEFAULT '{}',
  preferred_languages text[] DEFAULT '{en}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive username uniqueness
CREATE UNIQUE INDEX idx_profiles_username_lower ON profiles (lower(username));

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- 2. Global swipes table (no room_id)
-- ============================================================
CREATE TABLE user_swipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  tmdb_movie_id int NOT NULL,
  liked boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tmdb_movie_id)
);

CREATE INDEX idx_user_swipes_user ON user_swipes(user_id);
CREATE INDEX idx_user_swipes_user_liked ON user_swipes(user_id, liked) WHERE liked = true;
CREATE INDEX idx_user_swipes_movie_liked ON user_swipes(tmdb_movie_id, liked) WHERE liked = true;

-- RLS
ALTER TABLE user_swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own swipes"
  ON user_swipes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own swipes"
  ON user_swipes FOR SELECT
  USING (auth.uid() = user_id);

-- Enable realtime for user_swipes
ALTER PUBLICATION supabase_realtime ADD TABLE user_swipes;

-- ============================================================
-- 3. Helper RPCs
-- ============================================================

-- Check if a username is available (case-insensitive)
CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles WHERE lower(username) = lower(p_username)
  );
$$;

-- Get profile by username (public, for viewing someone's profile via link)
CREATE OR REPLACE FUNCTION public.get_profile_by_username(p_username text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(p)
  FROM (
    SELECT id, username, display_name, avatar_url, phone_verified, created_at
    FROM profiles
    WHERE lower(username) = lower(p_username)
  ) p;
$$;

-- Get swiped movie IDs for a user (to filter already-swiped movies)
CREATE OR REPLACE FUNCTION public.get_swiped_movie_ids(p_user_id uuid)
RETURNS int[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(tmdb_movie_id), '{}')
  FROM user_swipes
  WHERE user_id = p_user_id;
$$;
