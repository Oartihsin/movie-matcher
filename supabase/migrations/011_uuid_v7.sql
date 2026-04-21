-- Migrate primary key defaults from UUID v4 (random) to UUID v7 (time-ordered).
-- UUID v7 embeds a millisecond timestamp in the first 48 bits, giving:
--   - Append-only B-tree inserts (no page splits / fragmentation)
--   - Natural chronological ordering by PK
--   - Full compatibility with the existing uuid column type
-- Existing v4 rows are untouched — they sort before v7 rows.

-- UUID v7 generator (RFC 9562 compliant)
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_time bigint;
  v_bytes bytea;
BEGIN
  -- Milliseconds since Unix epoch
  v_time := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  -- 6 bytes timestamp + 10 bytes random
  v_bytes := set_byte(
    set_byte(
      set_byte(
        set_byte(
          set_byte(
            set_byte(
              gen_random_bytes(16),
              0, (v_time >> 40)::int & 255
            ),
            1, (v_time >> 32)::int & 255
          ),
          2, (v_time >> 24)::int & 255
        ),
        3, (v_time >> 16)::int & 255
      ),
      4, (v_time >> 8)::int & 255
    ),
    5, v_time::int & 255
  );

  -- Set version (0111 = 7) in byte 6
  v_bytes := set_byte(v_bytes, 6, (get_byte(v_bytes, 6) & 15) | 112);
  -- Set variant (10xx) in byte 8
  v_bytes := set_byte(v_bytes, 8, (get_byte(v_bytes, 8) & 63) | 128);

  RETURN encode(v_bytes, 'hex')::uuid;
END;
$$;

-- Update defaults on active tables
ALTER TABLE user_swipes ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE connections ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE connection_matches ALTER COLUMN id SET DEFAULT uuid_generate_v7();
