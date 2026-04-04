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
