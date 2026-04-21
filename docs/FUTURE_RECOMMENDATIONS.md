# Future Recommendations

Deferred tasks with detailed approach, changes, and success criteria. Ordered by impact.

---

## 1. Add Premium Undo/Re-Swipe Feature (#29)

**Priority:** High — user-facing feature, revenue potential
**Dependencies:** None (upsert + trigger already in place)

### Problem
Users accidentally swipe left on a movie they wanted to like. No way to go back.

### Approach
- Track the **previous movie** in `swipeStore` (the one before `currentIndex`)
- Add an "Undo" button (↩) between the ✕ and ♥ buttons, visible only to premium users
- On undo: decrement `currentIndex`, call `recordSwipe` with the corrected `liked` value
- The existing upsert (`ON CONFLICT DO UPDATE`) handles the vote change
- The Postgres trigger re-checks matches if the new vote is `liked = true`
- Limit: only the **immediately previous** movie (not unlimited history)

### Files to Modify
| File | Change |
|------|--------|
| `src/stores/swipeStore.ts` | Add `previousMovie` state, `undoSwipe(userId)` action |
| `app/(app)/index.tsx` | Add undo button, conditionally render for premium users |
| `src/types/app.ts` | Add `is_premium: boolean` to `Profile` type |
| `supabase/migrations/` | Add `is_premium` column to `profiles` table |

### Success Criteria
- [ ] Undo button appears only for premium users
- [ ] Tapping undo reverts to previous card with correct poster/data
- [ ] Re-swiping right triggers match detection via trigger
- [ ] Re-swiping left on a previously liked movie does NOT create false matches
- [ ] Undo is disabled if no previous movie exists (first card)
- [ ] Only one level of undo (can't undo the undo)

---

## 2. Partition user_swipes Table + Archival Policy (#25)

**Priority:** Medium — needed at ~10M+ rows
**Dependencies:** Requires Supabase Pro plan (pg_cron) or self-hosted Postgres

### Problem
`user_swipes` grows unbounded. At millions of rows: slow vacuuming, index bloat, lock contention during autovacuum.

### Approach
**Option A: Range partitioning by month (recommended)**
```sql
-- Convert to partitioned table
CREATE TABLE user_swipes_partitioned (
  LIKE user_swipes INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE user_swipes_y2026m01 PARTITION OF user_swipes_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ... repeat per month

-- Auto-create future partitions via pg_cron job (monthly)
```

**Key challenge:** The UNIQUE constraint `(user_id, tmdb_movie_id)` must include the partition key `created_at`. This means the constraint becomes `(user_id, tmdb_movie_id, created_at)`, which breaks upsert behavior (two rows for the same movie in different months).

**Workaround:** Add a unique index on `(user_id, tmdb_movie_id)` as a non-constraint index. Postgres will still enforce uniqueness but won't use it for partition routing. This requires testing.

**Option B: Archival without partitioning (simpler)**
- Create `user_swipes_archive` table (same schema)
- Monthly pg_cron job moves rows older than 6 months: `INSERT INTO archive SELECT ... WHERE created_at < now() - interval '6 months'; DELETE FROM user_swipes WHERE ...`
- Adjust `filter_unswiped_movie_ids` to check both tables
- Much simpler, no schema migration

### Files to Modify
| File | Change |
|------|--------|
| `supabase/migrations/` | New migration: partition setup or archive table + pg_cron job |
| `supabase/migrations/013_filter_unswiped.sql` | Update RPC to query both tables (if archival approach) |

### Success Criteria
- [ ] Writes to `user_swipes` remain fast (<5ms p99) at 50M+ rows
- [ ] Archival runs automatically without manual intervention
- [ ] `filter_unswiped_movie_ids` returns correct results spanning archive + live data
- [ ] No duplicate swipes across partitions/archives
- [ ] Trigger `trg_check_matches_after_swipe` fires correctly on partitioned table

---

## 3. Integrate APNs/FCM Push Notifications (#19)

**Priority:** Medium — engagement driver
**Dependencies:** Apple Developer account (APNs certs), Firebase project (FCM), Supabase Edge Function or external service

### Problem
Users don't know when they get a new match or connection request unless they open the app.

### Approach
1. **Client setup:**
   - Install `expo-notifications`
   - Request push permission on first app open (after onboarding)
   - Register device token with Supabase (store in `profiles.push_token` or new `device_tokens` table)

2. **Server-side:**
   - Create Edge Function `send-push-notification` that sends via APNs (iOS) / FCM (Android)
   - Modify `check_matches_for_swipe` trigger: after inserting a match, call `pg_net` HTTP extension to invoke the Edge Function
   - Modify `send_connection_request` RPC: notify addressee of incoming request

3. **Notification types:**
   - "New match! You and {friend} both liked {movie}" → deep link to connection matches
   - "{friend} sent you a connection request" → deep link to connections page
   - Weekly digest: "You have {n} new matches this week" (optional, via pg_cron)

### Files to Modify
| File | Change |
|------|--------|
| `app/(app)/_layout.tsx` | Register for push notifications, store token |
| `src/lib/notifications.ts` | New: push registration, token management |
| `supabase/functions/send-push/` | New Edge Function: APNs/FCM delivery |
| `supabase/migrations/` | Add `push_token` to profiles or new `device_tokens` table |
| `supabase/migrations/006_connection_matches.sql` | Update trigger to call push Edge Function via `pg_net` |

### Success Criteria
- [ ] Push permission requested after onboarding (not before)
- [ ] Device token stored in Supabase, updated on each app launch
- [ ] Match notification arrives within 5s of match detection
- [ ] Connection request notification arrives within 5s
- [ ] Tapping notification opens correct screen (deep link)
- [ ] No duplicate notifications
- [ ] Graceful handling when push permission denied

---

## 4. Add Sentry Error Monitoring (#14)

**Priority:** Medium — observability
**Dependencies:** Sentry account (free tier sufficient)

### Approach
1. Install `@sentry/react-native`
2. Initialize in `app/_layout.tsx` (root layout)
3. Configure source maps upload in EAS Build
4. Wrap navigation with Sentry routing instrumentation
5. Add breadcrumbs for key user actions (swipe, connect, login)
6. Set user context on auth state change

### Files to Modify
| File | Change |
|------|--------|
| `app/_layout.tsx` | Sentry.init(), wrap with Sentry error boundary |
| `app.json` | Add Sentry plugin config |
| `src/lib/sentry.ts` | New: Sentry config, helpers |
| `src/stores/authStore.ts` | Set Sentry user context on login/logout |

### Success Criteria
- [ ] Unhandled JS exceptions appear in Sentry dashboard with stack traces
- [ ] Source maps resolve to original TypeScript lines
- [ ] User ID attached to error events
- [ ] Key actions tracked as breadcrumbs (swipe, connect, login, logout)
- [ ] No PII leaked (no email/phone in Sentry)

---

## 5. Add Redis Caching Layer — Upstash (#18)

**Priority:** Low-Medium — performance optimization
**Dependencies:** Upstash account, Supabase Edge Function update

### Problem
Every feed load makes 4 parallel TMDB API calls. Popular/top-rated results change infrequently — caching saves upstream API quota and reduces latency.

### Approach
1. Create Upstash Redis instance (serverless, pay-per-request)
2. In `tmdb-proxy` Edge Function:
   - Before calling TMDB: check Redis for cached response (`GET tmdb:{path}:{params_hash}`)
   - If cached: return immediately (skip TMDB call)
   - If miss: call TMDB, store result with TTL (`SET ... EX 3600` — 1 hour for popular, 6 hours for top-rated)
3. Cache key format: `tmdb:/movie/popular:page=1:language=en-US`
4. TTLs by endpoint:
   - `/movie/popular`: 1 hour
   - `/discover/movie` (top-rated): 6 hours
   - `/discover/movie` (new releases): 2 hours
   - `/movie/{id}`: 24 hours

### Files to Modify
| File | Change |
|------|--------|
| `supabase/functions/tmdb-proxy/index.ts` | Add Upstash Redis client, cache-through logic |

### Success Criteria
- [ ] Cache hit rate >60% after warmup
- [ ] TMDB API calls reduced by >50%
- [ ] Feed load latency reduced by >200ms on cache hit
- [ ] Cache invalidation works (TTL-based, no stale data beyond TTL)
- [ ] Upstash costs <$5/month at 10K DAU

---

## 6. Deploy Invite Link Redirect Service (#23)

**Priority:** Low — marketing/distribution feature
**Dependencies:** Domain (moviematcher.app), hosting (Vercel/Cloudflare Pages)

### Problem
Deep links (`moviematcher://connect?from=USER_ID`) only work with app installed. Need a web URL that handles both installed and not-installed cases.

### Approach
1. Deploy a simple static site at `moviematcher.app`
2. Route `/u/{username}` to a redirect page:
   - Has Apple Smart Banner meta tag (opens app if installed)
   - Has Android intent filter link
   - Falls back to App Store / Play Store links
   - Shows basic landing page on desktop
3. Can use Vercel Edge Functions or Cloudflare Workers for dynamic redirects
4. Add `.well-known/apple-app-site-association` and `assetlinks.json` for universal links

### Files to Create
| File | Purpose |
|------|---------|
| `web/` | New directory: redirect service |
| `web/pages/u/[username].tsx` | Dynamic redirect page |
| `web/public/.well-known/apple-app-site-association` | iOS universal links |
| `web/public/.well-known/assetlinks.json` | Android app links |

### Success Criteria
- [ ] `moviematcher.app/u/johndoe` opens app on iOS/Android (if installed)
- [ ] Falls back to store listing (if not installed)
- [ ] Shows landing page with QR code on desktop
- [ ] Universal links work without user clicking "Open in App" banner
- [ ] Page loads in <500ms (static/edge-rendered)

---

## 7. Proxy TMDB Poster Images Through CDN (#26)

**Priority:** Low — performance optimization
**Dependencies:** CDN service (Cloudflare/CloudFront)

### Problem
Poster images load directly from `image.tmdb.org`. This is a third-party dependency — if TMDB CDN is slow or down, the app's image loading degrades. Also no control over caching headers.

### Approach
1. Set up Cloudflare Worker or CloudFront distribution that proxies `image.tmdb.org`
2. Add aggressive caching headers (posters rarely change): `Cache-Control: public, max-age=31536000`
3. Update `TMDB_IMAGE_BASE` in `constants.ts` to point to CDN URL
4. Optional: resize/optimize images at the edge (WebP conversion)

### Files to Modify
| File | Change |
|------|--------|
| `src/lib/constants.ts` | Change `TMDB_IMAGE_BASE` to CDN URL |
| CDN config (external) | Proxy rule: `cdn.moviematcher.app/t/p/{size}/{path}` → `image.tmdb.org/t/p/{size}/{path}` |

### Success Criteria
- [ ] All poster images load through CDN
- [ ] Cache hit rate >90% after warmup
- [ ] Image load time reduced by >100ms (CDN edge vs TMDB origin)
- [ ] App works if CDN is down (fallback to direct TMDB URL)
- [ ] CDN costs <$10/month at 10K DAU

---

## 8. Add API Rate Limiting — Enhancements

**Already implemented (basic).** Future enhancements:

### Sliding Window Instead of Fixed Window
Current `check_rate_limit` uses fixed windows. A user could make 60 swipes at 0:59, then 60 more at 1:01 (120 in 2 seconds). Sliding window prevents this.

### Per-IP Rate Limiting
Current limits are per-user. Unauthenticated endpoints (login, signup) need per-IP limits to prevent brute force. Requires Edge Function middleware or Supabase's built-in rate limiting.

### Exponential Backoff on Repeated Violations
Instead of flat rejection, increase the lockout duration: 1min → 5min → 15min → 1hour.
