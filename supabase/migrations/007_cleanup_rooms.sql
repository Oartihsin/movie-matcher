-- Phase 5: Remove legacy room tables and RPCs

-- Drop old RPCs
DROP FUNCTION IF EXISTS create_room(text, uuid);
DROP FUNCTION IF EXISTS join_room(text, uuid);
DROP FUNCTION IF EXISTS get_room_by_code(text);
DROP FUNCTION IF EXISTS get_room_member_count(uuid);
DROP FUNCTION IF EXISTS record_swipe(uuid, uuid, int, boolean);

-- Drop old views
DROP VIEW IF EXISTS matches;

-- Drop old tables (order matters due to foreign keys)
DROP TABLE IF EXISTS swipes;
DROP TABLE IF EXISTS room_members;
DROP TABLE IF EXISTS rooms;
