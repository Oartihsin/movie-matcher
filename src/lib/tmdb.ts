import { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE } from './constants';
import type { TMDBMovie, TMDBResponse } from '../types/tmdb';

export async function fetchPopularMovies(page: number): Promise<TMDBMovie[]> {
  const res = await fetch(
    `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=${page}&language=en-US`
  );
  if (!res.ok) {
    throw new Error(`TMDB error: ${res.status}`);
  }
  const data: TMDBResponse = await res.json();
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
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    page: String(page),
    sort_by: sortBy,
    'vote_count.gte': '10',
  });
  if (genreIds.length > 0) params.set('with_genres', genreIds.join(','));
  if (languages.length > 0) params.set('with_original_language', languages.join('|'));
  if (extraParams) Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));

  const res = await fetch(`${TMDB_BASE_URL}/discover/movie?${params.toString()}`);
  if (!res.ok) return [];
  const data: TMDBResponse = await res.json();
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
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    page: String(page),
    sort_by: 'popularity.desc',
    'vote_count.gte': '10',
  });
  if (genreIds.length > 0) params.set('with_genres', genreIds.join(','));
  if (languages.length > 0) params.set('with_original_language', languages.join('|'));
  const res = await fetch(`${TMDB_BASE_URL}/discover/movie?${params.toString()}`);
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  const data: TMDBResponse = await res.json();
  return data.results.filter((m) => m.poster_path !== null && m.vote_count > 0);
}

export async function fetchMovieDetails(movieId: number): Promise<TMDBMovie> {
  const res = await fetch(
    `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`
  );
  if (!res.ok) {
    throw new Error(`TMDB error: ${res.status}`);
  }
  const data = await res.json();
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
