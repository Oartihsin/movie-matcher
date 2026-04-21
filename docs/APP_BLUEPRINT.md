# App Blueprint: Swipe-Based Discovery Platform

> Feed this file to any coding AI agent to scaffold a new app with the same architecture, patterns, and polish as Movie Matcher — but for a different domain (restaurants, books, travel, music, etc.).

---

## 1. What This App Does

A mobile-first discovery app where users **swipe through items** (movies, restaurants, books — anything), **connect with friends**, and **see what they both liked**. Think "Tinder for X" where X is the domain you choose.

### Core User Flow
```
Sign Up → Onboarding (verify phone, set username, pick preferences)
    → Swipe Feed (like/pass on items)
    → Connect with Friends (by username)
    → View Mutual Likes (matched items per friend)
```

### Key Features
- Swipe-based card UI with gesture + button input
- Friend connections (send/accept/block requests)
- Real-time mutual match detection
- First-time tutorial overlay
- Share/invite friends via username link
- Preference-based feed personalization

---

## 2. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Expo SDK 55 + React Native | Cross-platform, fast iteration, OTA updates |
| Routing | Expo Router (file-based) | Simple auth flow, deep linking |
| State | Zustand | Minimal boilerplate, no providers, works with React 19 |
| Backend | Supabase (Postgres + Auth + Realtime + Edge Functions) | Full BaaS, SQL flexibility, row-level security |
| Animations | React Native Reanimated | 60fps gesture-driven animations on UI thread |
| Gestures | React Native Gesture Handler | Native pan/swipe recognition |
| Images | expo-image | Optimized loading, caching, blurhash placeholders |
| Auth Storage | expo-secure-store | OS keychain encryption for JWT tokens |
| Haptics | expo-haptics | Tactile feedback on swipes |

### Package.json Essentials
```json
{
  "dependencies": {
    "expo": "~55.0.0",
    "react": "19.x",
    "react-native": "0.83.x",
    "expo-router": "~55.0.0",
    "expo-image": "~55.0.0",
    "expo-secure-store": "~55.0.0",
    "expo-haptics": "~55.0.0",
    "expo-auth-session": "~55.0.0",
    "expo-web-browser": "~55.0.0",
    "expo-clipboard": "~55.0.0",
    "@supabase/supabase-js": "^2.99.0",
    "@react-native-async-storage/async-storage": "2.x",
    "react-native-reanimated": "4.x",
    "react-native-gesture-handler": "~2.30.0",
    "react-native-safe-area-context": "~5.6.0",
    "react-native-screens": "~4.23.0",
    "zustand": "^5.0.0"
  }
}
```

---

## 3. Project Structure

```
app/
├── index.tsx                    # Root redirect → login or home
├── _layout.tsx                  # Root layout: font loading, auth routing
├── (auth)/
│   ├── _layout.tsx             # Stack navigator for auth screens
│   ├── login.tsx               # Email/password + OAuth login
│   ├── signup.tsx              # Registration + email confirmation
│   └── onboarding.tsx          # 3-step: phone verify → username → preferences
└── (app)/
    ├── _layout.tsx             # Tab navigator or stack for main app
    ├── index.tsx               # Swipe feed (main screen)
    ├── profile.tsx             # User settings + preference editing
    ├── connections/
    │   ├── index.tsx           # Friend list + search + pending requests
    │   └── [connectionId].tsx  # Matched items grid for a connection
    └── user/
        └── [username].tsx      # Public profile (from invite link)

src/
├── components/
│   ├── ItemCard.tsx            # Renders a single item (poster, title, metadata)
│   ├── SwipeableCard.tsx       # Gesture wrapper: pan, rotate, LIKE/NOPE overlays
│   ├── SwipeTutorial.tsx       # First-time animated overlay
│   ├── MatchToast.tsx          # Slide-down notification on mutual like
│   └── SharePrompt.tsx         # One-time invite prompt
├── hooks/
│   ├── useAuth.ts              # Session init, sign up/in/out, OAuth
│   ├── useConnections.ts       # Fetch + real-time connection updates
│   ├── useMatchSubscription.ts # Real-time match notifications
│   └── usePhoneVerification.ts # OTP send + verify flow
├── stores/
│   ├── authStore.ts            # User, session, profile state
│   ├── swipeStore.ts           # Feed, swipe recording, preferences
│   ├── connectionStore.ts      # Friends, requests, pending count
│   └── matchStore.ts           # Match counts, match lists, toast state
├── lib/
│   ├── supabase.ts             # Supabase client (lazy init, secure storage)
│   ├── secure-storage.ts       # SecureStore adapter with chunking + migration
│   ├── api.ts                  # External API wrapper (proxied via Edge Function)
│   └── constants.ts            # URLs, thresholds, config
└── types/
    ├── app.ts                  # Profile, Connection, Match types
    └── domain.ts               # Domain-specific item types (Movie, Restaurant, etc.)

supabase/
├── migrations/                 # Numbered SQL migrations
└── functions/
    └── api-proxy/              # Edge Function: proxies external API, hides keys, rate limits
```

---

## 4. Database Schema (Supabase Postgres)

### Tables

```sql
-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  phone_verified boolean DEFAULT false,
  preferred_categories int[],      -- domain-specific: genre IDs, cuisine types, etc.
  preferred_tags text[],           -- domain-specific: languages, dietary, etc.
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User swipes on items
CREATE TABLE user_swipes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  item_id int NOT NULL,            -- external API item ID
  liked boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, item_id)
);

-- Friend connections
CREATE TABLE connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  requester_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  addressee_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

-- Materialized mutual likes per connection
CREATE TABLE connection_matches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  connection_id uuid REFERENCES connections ON DELETE CASCADE NOT NULL,
  item_id int NOT NULL,
  matched_at timestamptz DEFAULT now(),
  UNIQUE (connection_id, item_id)
);

-- Rate limiting log
CREATE TABLE rate_limit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### UUID v7 Generator
```sql
-- Time-ordered UUIDs: append-only B-tree inserts, natural chronological ordering
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
  v_time bigint;
  v_bytes bytea;
BEGIN
  v_time := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_bytes := set_byte(set_byte(set_byte(set_byte(set_byte(set_byte(
    gen_random_bytes(16),
    0, (v_time >> 40)::int & 255), 1, (v_time >> 32)::int & 255),
    2, (v_time >> 24)::int & 255), 3, (v_time >> 16)::int & 255),
    4, (v_time >> 8)::int & 255), 5, v_time::int & 255);
  v_bytes := set_byte(v_bytes, 6, (get_byte(v_bytes, 6) & 15) | 112);
  v_bytes := set_byte(v_bytes, 8, (get_byte(v_bytes, 8) & 63) | 128);
  RETURN encode(v_bytes, 'hex')::uuid;
END;
$$;
```

### Indexes
```sql
CREATE INDEX idx_swipes_user ON user_swipes(user_id);
CREATE INDEX idx_swipes_user_liked ON user_swipes(user_id, liked) WHERE liked = true;
CREATE INDEX idx_swipes_item_liked ON user_swipes(item_id, liked) WHERE liked = true;
CREATE INDEX idx_connections_requester ON connections(requester_id, status);
CREATE INDEX idx_connections_addressee ON connections(addressee_id, status);
CREATE INDEX idx_matches_connection ON connection_matches(connection_id);
CREATE INDEX idx_rate_limit_lookup ON rate_limit_log(user_id, action, created_at DESC);
```

### Row-Level Security (RLS)
```sql
-- Every table: ALTER TABLE x ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, users can insert/update own
CREATE POLICY "Public read" ON profiles FOR SELECT USING (true);
CREATE POLICY "Own insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Own update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Swipes: users can read/insert/update own
CREATE POLICY "Own read" ON user_swipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own insert" ON user_swipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON user_swipes FOR UPDATE USING (auth.uid() = user_id);

-- Connections: users can see connections they're part of
CREATE POLICY "Own connections" ON connections FOR SELECT
  USING (auth.uid() IN (requester_id, addressee_id));
CREATE POLICY "Can send" ON connections FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Can respond" ON connections FOR UPDATE
  USING (auth.uid() = addressee_id AND status = 'pending');

-- Matches: users can see matches for their accepted connections
CREATE POLICY "Own matches" ON connection_matches FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM connections c
    WHERE c.id = connection_matches.connection_id
      AND (c.requester_id = auth.uid() OR c.addressee_id = auth.uid())
      AND c.status = 'accepted'
  ));
```

### Key RPCs (SECURITY DEFINER)

```sql
-- Check username availability (case-insensitive)
CREATE FUNCTION is_username_available(p_username text) RETURNS boolean;

-- Get public profile by username
CREATE FUNCTION get_profile_by_username(p_username text) RETURNS json;

-- Server-side feed dedup: return only unswiped item IDs
CREATE FUNCTION filter_unswiped_item_ids(p_item_ids int[]) RETURNS int[];

-- Send connection request (handles duplicates, auto-accepts reverse)
CREATE FUNCTION send_connection_request(p_addressee_id uuid) RETURNS json;

-- Accept/block connection (triggers match backfill on accept)
CREATE FUNCTION respond_to_connection(p_connection_id uuid, p_action text) RETURNS json;

-- Get all connections with profile info joined
CREATE FUNCTION get_connections_for_user() RETURNS json;

-- Get pending incoming request count
CREATE FUNCTION get_pending_connection_count() RETURNS int;

-- Check for mutual likes across all connections (called by trigger)
-- Uses advisory locks to prevent race condition on concurrent swipes
CREATE FUNCTION check_matches_for_swipe(p_user_id uuid, p_item_id int) RETURNS int;

-- Backfill all mutual likes when connection is accepted
CREATE FUNCTION backfill_matches_for_connection(p_connection_id uuid) RETURNS int;

-- Get matched items for a connection
CREATE FUNCTION get_matches_for_connection(p_connection_id uuid) RETURNS TABLE(...);

-- Get match count per connection (for badges)
CREATE FUNCTION get_match_counts() RETURNS TABLE(connection_id uuid, match_count bigint);

-- Reusable rate limiter
CREATE FUNCTION check_rate_limit(p_user_id uuid, p_action text, p_max_count int, p_window_seconds int) RETURNS boolean;
```

### Triggers

```sql
-- Auto-detect matches server-side when a liked swipe is recorded
CREATE FUNCTION trigger_check_matches() RETURNS trigger AS $$
BEGIN
  IF NEW.liked = true THEN
    PERFORM check_matches_for_swipe(NEW.user_id, NEW.item_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_check_matches_after_swipe
  AFTER INSERT OR UPDATE OF liked ON user_swipes
  FOR EACH ROW EXECUTE FUNCTION trigger_check_matches();
```

### Realtime
```sql
-- Enable CDC for real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE connections;
ALTER PUBLICATION supabase_realtime ADD TABLE connection_matches;
```

---

## 5. Auth Flow

### Implementation Pattern

```
1. SIGNUP: email/password or OAuth (Google, Apple)
   → Supabase sends email confirmation
   → User clicks link → redirected back to app

2. ONBOARDING (3 steps, shown once after first signup):
   Step 1: Phone verification (OTP via Supabase Auth)
   Step 2: Username (checked via is_username_available RPC) + display name
   Step 3: Preferences (categories + tags)
   → INSERT INTO profiles

3. LOGIN: email/password or OAuth
   → JWT stored in SecureStore (OS keychain, encrypted)
   → Auto-refresh enabled

4. SESSION PERSISTENCE:
   → SecureStore adapter with chunking (2048-byte limit workaround)
   → Auto-migrates from AsyncStorage on upgrade
   → Session survives app restarts

5. ROUTING LOGIC (root layout):
   No session → /login
   Session + no profile → /onboarding
   Session + profile → /home
```

### SecureStore Adapter Pattern
```typescript
// Supabase-compatible storage backed by expo-secure-store
// Chunks values >2000 bytes into numbered keys
// Auto-migrates existing AsyncStorage sessions on first read
const secureStorage = {
  getItem(key): Promise<string | null>,   // reads chunks, migrates legacy
  setItem(key, value): Promise<void>,     // chunks if needed
  removeItem(key): Promise<void>,         // cleans up all chunks
};
```

---

## 6. Swipe Card UI

### Architecture
```
SwipeableCard (gesture wrapper)
  └── ItemCard (visual content)
```

### SwipeableCard Behavior
- **Pan gesture** with 20px horizontal activation threshold
- **Rotation** interpolated: -8° (left) to +8° (right) based on translateX
- **LIKE/NOPE overlay** opacity fades in proportional to swipe distance
- **Swipe threshold**: 120px triggers auto-completion
- **Below threshold**: spring animation back to center (damping: 15, stiffness: 200)
- **Above threshold**: timing animation off-screen (300ms), then `onSwipe(liked)` callback
- **Fail offset Y**: [-15, 15] prevents gesture from interfering with vertical scroll

### Action Buttons
- Two circular buttons (60px) below the card: ✕ (pass) and ♥ (like)
- ✕ button: `#ff6b6b` border, triggers left swipe programmatically
- ♥ button: `#4ecdc4` border, triggers right swipe programmatically
- Haptic feedback on every swipe (`ImpactFeedbackStyle.Light`)

### Feed Loading
- Fetch batch from external API via Edge Function proxy
- Server-side dedup: `filter_unswiped_item_ids(batch_ids)` RPC
- Prefetch next batch when `remaining <= PREFETCH_THRESHOLD (5)` cards
- Optimistic UI: advance card index immediately, save swipe async
- Rate limited: 60 swipes/min via Postgres `check_rate_limit`

---

## 7. Real-Time Features

### Connection Updates
```typescript
// Subscribe to connection changes for current user
supabase.channel('connections')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'connections',
    filter: `requester_id=eq.${userId}`,
  }, callback)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'connections',
    filter: `addressee_id=eq.${userId}`,
  }, callback)
  .subscribe();
```

### Match Notifications
```typescript
// Subscribe to new matches — one filter per accepted connection
let channel = supabase.channel('match-notifications');
for (const connId of acceptedConnectionIds) {
  channel = channel.on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'connection_matches',
    filter: `connection_id=eq.${connId}`,
  }, (payload) => {
    showMatchToast(payload.new.item_id);
    refreshMatchCounts();
  });
}
channel.subscribe();
```

**Key pattern:** Always scope subscriptions with filters. Never subscribe to an entire table — it receives all platform traffic.

---

## 8. Edge Function: API Proxy

```typescript
// Deno Edge Function: proxies external API, hides secret key, rate limits

const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;

serve(async (req) => {
  // 1. Require auth header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  // 2. Rate limit per user (extract from JWT)
  const userId = extractUserIdFromJwt(authHeader);
  if (isRateLimited(userId)) return new Response('Too Many Requests', { status: 429 });

  // 3. Proxy the request, inject secret API key
  const path = url.searchParams.get('path');
  const params = new URLSearchParams(url.searchParams);
  params.delete('path');
  params.set('api_key', Deno.env.get('API_KEY'));

  const apiRes = await fetch(`${API_BASE}${path}?${params}`);
  return new Response(await apiRes.text(), {
    status: apiRes.status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
});
```

**Deploy with:** `npx supabase functions deploy api-proxy --no-verify-jwt`
(Use `--no-verify-jwt` if your Supabase project uses ES256 JWT signing)

---

## 9. Animation Patterns

### Match Toast (slide down, auto-dismiss)
```typescript
const translateY = useSharedValue(-100);
const opacity = useSharedValue(0);

// Show
translateY.value = withSpring(0, { damping: 15 });
opacity.value = withTiming(1, { duration: 300 });

// Auto-dismiss after 3s
setTimeout(() => {
  translateY.value = withTiming(-100, { duration: 300 });
  opacity.value = withTiming(0, { duration: 300 });
}, 3000);
```

### Tutorial Overlay (bouncing arrows, pulsing rings)
```typescript
// Bouncing arrow (repeating)
arrowX.value = withDelay(100,
  withRepeat(
    withSequence(
      withTiming(-12, { duration: 400, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) })
    ), -1
  )
);

// Pulsing ring (repeating)
pulseScale.value = withRepeat(
  withSequence(
    withTiming(1.25, { duration: 600 }),
    withTiming(1.0, { duration: 600 })
  ), -1
);
```

### Share Prompt (fade in/out)
```typescript
opacity.value = withTiming(1, { duration: 400 }); // show
opacity.value = withTiming(0, { duration: 300 }); // dismiss
```

---

## 10. Error Handling Patterns

### Store Pattern (Zustand)
```typescript
// Every async action follows this pattern:
someAction: async () => {
  set({ isLoading: true, error: null });
  try {
    const { data, error } = await supabase.rpc('...');
    if (error) throw error;
    set({ data, isLoading: false });
  } catch (err: any) {
    set({ isLoading: false, error: err?.message ?? 'Something went wrong' });
  }
}
```

### Rate Limiting Pattern
```typescript
// Check rate limit BEFORE the operation
const { data: allowed } = await supabase.rpc('check_rate_limit', {
  p_user_id: userId,
  p_action: 'swipe',
  p_max_count: 60,
  p_window_seconds: 60,
});
if (allowed === false) return false; // silently reject

// For user-facing operations, show a message:
if (allowed === false) {
  set({ error: 'Too many requests. Please wait.' });
  return;
}
```

### Timeout Pattern
```typescript
const TIMEOUT = 10_000;
const result = await Promise.race([
  supabase.rpc('slow_operation'),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), TIMEOUT)),
]);
```

### Optimistic UI Pattern
```typescript
// 1. Update UI immediately
set({ currentIndex: nextIndex, likedItems: new Set([...state.likedItems, itemId]) });

// 2. Persist async (don't block UI)
const { error } = await supabase.from('user_swipes').upsert({ ... });

// 3. If error: could rollback (not implemented — rare enough to ignore)
if (error) return false;
return true;
```

---

## 11. Styling Guide

### Color Palette
```typescript
const colors = {
  background: '#16213e',       // Dark blue-gray (app background)
  cardBg: '#1a1a2e',           // Darker blue-gray (card surfaces)
  accent: '#e94560',           // Pink-red (primary action, links)
  like: '#4ecdc4',             // Teal (like button, positive)
  nope: '#ff6b6b',             // Red (pass button, negative)
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b0',
  border: 'rgba(255,255,255,0.1)',
  overlay: 'rgba(0,0,0,0.65)', // Tutorial/modal overlays
  pill: 'rgba(0,0,0,0.55)',    // Dark pill backgrounds for text on images
};
```

### Layout Constants
```typescript
const layout = {
  cardBorderRadius: 16,
  buttonSize: 60,
  buttonBorderRadius: 30,     // circle
  chipBorderRadius: 20,
  maxContentWidth: 430,        // constrain web to mobile viewport
  headerHeight: 56,
};
```

### Common Patterns
- **Always dark theme** (no light mode toggle)
- **Card surfaces** with subtle borders: `borderWidth: 1, borderColor: rgba(255,255,255,0.07)`
- **Floating action buttons** at bottom of screen
- **Badge indicators**: red circle with white count text
- **Chip grids**: rounded pills for tags/categories
- **Collapsible sections**: header row with chevron ▼/▲
- **iOS-style settings rows**: left label, right value/chevron
- **Dark pill overlays** for text on images: `backgroundColor: rgba(0,0,0,0.55), borderRadius: 20`

---

## 12. Race Condition Prevention

### Concurrent Match Detection
Two connected users swiping on the same item simultaneously can both miss the match (neither transaction sees the other's uncommitted row).

**Solution:** Advisory locks in `check_matches_for_swipe`:
```sql
-- Lock key = hash(connection_id, item_id)
-- Second transaction blocks until first commits, then sees the committed row
v_lock_key := hashtext(v_conn.connection_id::text || p_item_id::text);
PERFORM pg_advisory_xact_lock(v_lock_key);

-- Now safe to check if other user liked this item
IF EXISTS (SELECT 1 FROM user_swipes WHERE ...) THEN
  INSERT INTO connection_matches ...;
END IF;
```

---

## 13. One-Time Overlays Pattern

Used for tutorial, share prompt, and any future first-time experiences.

```typescript
// Check flag
const seen = await AsyncStorage.getItem('@feature_seen');
if (!seen) setShowOverlay(true);

// Dismiss + persist
const dismiss = useCallback(() => {
  setShowOverlay(false);
  AsyncStorage.setItem('@feature_seen', 'true');
}, []);

// Also dismiss on first meaningful action
const handleSwipe = () => {
  if (showOverlay) dismiss();
  // ... normal swipe logic
};
```

**Note:** Use AsyncStorage (not SecureStore) for non-sensitive flags. SecureStore is for auth tokens only.

---

## 14. Checklist: Adapting to a New Domain

When building a new app from this blueprint, replace:

| Movie Matcher | Your App |
|---------------|----------|
| TMDB API | Your external data API |
| `tmdb_movie_id` / `item_id` | Your item identifier |
| Genres + Languages | Your categories + tags |
| Movie poster card | Your item card (restaurant photo, book cover, etc.) |
| `tmdb-proxy` Edge Function | `api-proxy` Edge Function with your API key |
| `TMDB_IMAGE_BASE` | Your image CDN base URL |
| `fetchFeedBatch` (4 buckets) | Your feed algorithm (popular, trending, nearby, etc.) |

**Everything else stays the same:** auth flow, connections, match detection, real-time subscriptions, rate limiting, swipe UI, animations, error handling, secure storage.

---

## 15. Security Checklist

- [x] JWT stored in OS keychain (expo-secure-store), not AsyncStorage
- [x] API keys server-side only (Edge Function secrets, never in client bundle)
- [x] RLS on every table (no table readable without policy)
- [x] SECURITY DEFINER on RPCs (bypass RLS for aggregations, not for writes)
- [x] Rate limiting on all write operations (swipes, connections, API proxy)
- [x] Advisory locks on concurrent writes (match detection)
- [x] Upsert instead of insert (idempotent, no duplicate errors)
- [x] Phone verification during onboarding (spam prevention)
- [x] CORS headers on Edge Functions
- [x] No PII in error messages or logs

---

## 16. Performance Checklist

- [x] UUID v7 for primary keys (time-ordered, no B-tree fragmentation)
- [x] Server-side feed dedup (client never downloads full swipe history)
- [x] Optimistic UI (swipe advances immediately, save async)
- [x] Prefetch next batch at 5 remaining cards
- [x] Scoped Realtime subscriptions (per-connection filters, not whole-table)
- [x] Match detection via Postgres trigger (no client RPC roundtrip)
- [x] Partial indexes (`WHERE liked = true`) for match lookups
- [x] Opportunistic cleanup in rate limiter (no separate cron job needed)
- [x] Lazy Supabase client init (no SSR penalty on web)
- [x] expo-image for optimized image loading + caching
