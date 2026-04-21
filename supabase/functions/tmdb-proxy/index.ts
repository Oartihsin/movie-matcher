import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') ?? ''
const TMDB_BASE = 'https://api.themoviedb.org/3'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── In-memory rate limiter (resets on cold start) ────────────────────────────
const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30       // max requests per window
const RATE_WINDOW = 60_000  // 1 minute in ms

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW })
    return false
  }
  if (entry.count >= RATE_LIMIT) return true
  entry.count++
  return false
}

function extractUserIdFromJwt(authHeader: string): string | null {
  try {
    const token = authHeader.replace('Bearer ', '')
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub ?? null
  } catch {
    return null
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // Require a Supabase auth token (anon key or user JWT)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // Rate limit per user (falls back to full token hash for anon key)
  const userId = extractUserIdFromJwt(authHeader) ?? authHeader.slice(-16)
  if (isRateLimited(userId)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)

  // Client sends: ?path=/movie/popular&page=1&language=en-US
  const tmdbPath = url.searchParams.get('path')
  if (!tmdbPath || !tmdbPath.startsWith('/')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid path' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // Forward all params except 'path', inject secret api_key
  const params = new URLSearchParams()
  for (const [k, v] of url.searchParams.entries()) {
    if (k !== 'path') params.set(k, v)
  }
  params.set('api_key', TMDB_API_KEY)

  const tmdbRes = await fetch(`${TMDB_BASE}${tmdbPath}?${params.toString()}`)
  const data = await tmdbRes.json()

  return new Response(JSON.stringify(data), {
    status: tmdbRes.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
