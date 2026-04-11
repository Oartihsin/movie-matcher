import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') ?? ''
const TMDB_BASE = 'https://api.themoviedb.org/3'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
