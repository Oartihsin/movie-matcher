export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
// TMDB API key removed from client — lives in Edge Function secret (TMDB_API_KEY)
export const TMDB_PROXY_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/tmdb-proxy`;
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const PREFETCH_THRESHOLD = 5;
export const MOVIES_PER_PAGE = 20;
