import { SUPABASE_ANON_KEY, TMDB_PROXY_URL, TMDB_IMAGE_BASE } from './constants';
import { getSupabase } from './supabase';
import type { TMDBMovie, TMDBResponse } from '../types/tmdb';

// ─── Proxy helper ─────────────────────────────────────────────────────────────

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await getSupabase().auth.getSession();
  return `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`;
}

async function tmdbFetch(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ path, ...params }).toString();
  const auth = await getAuthHeader();
  const res = await fetch(`${TMDB_PROXY_URL}?${qs}`, {
    headers: {
      Authorization: auth,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) throw new Error(`TMDB proxy error: ${res.status}`);
  return res.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchPopularMovies(page: number): Promise<TMDBMovie[]> {
  const data: TMDBResponse = await tmdbFetch('/movie/popular', {
    page: String(page),
    language: 'en-US',
  });
  return data.results.filter((m) => m.poster_path !== null && m.vote_count > 0);
}

// Fisher-Yates shuffle — uniform distribution, not the biased sort trick
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function discoverPage(
  genreIds: number[],
  languages: string[],
  sortBy: string,
  page: number,
  extraParams?: Record<string, string>
): Promise<TMDBMovie[]> {
  const params: Record<string, string> = {
    page: String(page),
    sort_by: sortBy,
    'vote_count.gte': '10',
  };
  if (genreIds.length > 0) params['with_genres'] = genreIds.join(',');
  if (languages.length > 0) params['with_original_language'] = languages.join('|');
  if (extraParams) Object.assign(params, extraParams);

  const data: TMDBResponse = await tmdbFetch('/discover/movie', params);
  return data.results.filter((m) => m.poster_path !== null && m.vote_count > 0);
}

// Deterministic-ish page drift per cycle so repeat loads pull different slices
function cyclePage(base: number, cycle: number, max: number): number {
  return ((base - 1 + cycle) % max) + 1;
}

export async function fetchFeedBatch(
  genreIds: number[],
  languages: string[],
  cycle: number
): Promise<TMDBMovie[]> {
  const hasPrefs = genreIds.length > 0 || languages.length > 0;

  // Two-year window for new releases
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const releaseFrom = twoYearsAgo.toISOString().split('T')[0];

  const [popular, topRated, newReleases, wildCard] = await Promise.all([
    // Bucket 1: Popular in user's genres — drifts across pages with each cycle
    hasPrefs
      ? discoverPage(genreIds, languages, 'popularity.desc', cyclePage(1, cycle, 5))
      : fetchPopularMovies(cyclePage(1, cycle, 5)),

    // Bucket 2: Top rated in user's genres — different page drift
    hasPrefs
      ? discoverPage(genreIds, languages, 'vote_average.desc', cyclePage(1, cycle, 8), {
          'vote_count.gte': '500',
        })
      : Promise.resolve([]),

    // Bucket 3: New releases in user's genres
    hasPrefs
      ? discoverPage(genreIds, languages, 'primary_release_date.desc', cyclePage(1, cycle, 3), {
          'primary_release_date.gte': releaseFrom,
          'vote_count.gte': '10',
        })
      : Promise.resolve([]),

    // Bucket 4: Wild card — popular movies regardless of genre (serendipity)
    fetchPopularMovies(cyclePage(3, cycle, 8)),
  ]);

  // Merge all buckets, deduplicate by movie ID
  const seen = new Set<number>();
  const merged: TMDBMovie[] = [];
  for (const movie of [...popular, ...topRated, ...newReleases, ...wildCard]) {
    if (!seen.has(movie.id)) {
      seen.add(movie.id);
      merged.push(movie);
    }
  }

  return shuffle(merged);
}

// Keep for legacy / fallback use
export async function fetchDiscoverMovies(
  page: number,
  genreIds: number[],
  languages: string[]
): Promise<TMDBMovie[]> {
  if (genreIds.length === 0 && languages.length === 0) {
    return fetchPopularMovies(page);
  }
  const params: Record<string, string> = {
    page: String(page),
    sort_by: 'popularity.desc',
    'vote_count.gte': '10',
  };
  if (genreIds.length > 0) params['with_genres'] = genreIds.join(',');
  if (languages.length > 0) params['with_original_language'] = languages.join('|');

  const data: TMDBResponse = await tmdbFetch('/discover/movie', params);
  return data.results.filter((m) => m.poster_path !== null && m.vote_count > 0);
}

export async function fetchMovieDetails(movieId: number): Promise<TMDBMovie> {
  const data = await tmdbFetch(`/movie/${movieId}`, { language: 'en-US' });
  // /movie/{id} returns genres:[{id,name}] instead of genre_ids:[number]
  if (data.genres && !data.genre_ids) {
    data.genre_ids = data.genres.map((g: { id: number }) => g.id);
  }
  return data;
}

export function getPosterUrl(path: string, size = 'w500'): string {
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(path: string, size = 'w780'): string {
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
