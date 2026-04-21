import { create } from 'zustand';
import type { TMDBMovie } from '../types/tmdb';
import { fetchFeedBatch } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
import { PREFETCH_THRESHOLD } from '../lib/constants';

interface SwipeState {
  movies: TMDBMovie[];
  currentIndex: number;
  feedCycle: number;
  isLoading: boolean;
  loadError: string | null;
  likedMovieIds: Set<number>;
  sessionSwipedIds: Set<number>; // optimistic dedup for current session only
  preferredGenres: number[];
  preferredLanguages: string[];

  loadMovies: (cycle?: number, genreIds?: number[], languages?: string[]) => Promise<void>;
  setPreferences: (genreIds: number[], languages: string[]) => void;
  recordSwipe: (userId: string, movieId: number, liked: boolean) => Promise<boolean>;
  reset: () => void;
}

export const useSwipeStore = create<SwipeState>((set, get) => ({
  movies: [],
  currentIndex: 0,
  feedCycle: 0,
  isLoading: false,
  loadError: null,
  likedMovieIds: new Set(),
  sessionSwipedIds: new Set(),
  preferredGenres: [],
  preferredLanguages: [],

  setPreferences: (genreIds, languages) => {
    set({ preferredGenres: genreIds, preferredLanguages: languages });
  },

  loadMovies: async (cycle, genreIds, languages) => {
    set({ isLoading: true, loadError: null });
    try {
      const { preferredGenres, preferredLanguages, feedCycle, sessionSwipedIds } = get();
      const genres = genreIds ?? preferredGenres;
      const langs = languages ?? preferredLanguages;
      const currentCycle = cycle ?? feedCycle;

      const allMovies = await fetchFeedBatch(genres, langs, currentCycle);
      const allIds = allMovies.map((m) => m.id);

      // Server-side dedup: Postgres filters out already-swiped movies
      const { data: unswipedIds } = await supabase.rpc('filter_unswiped_movie_ids', {
        p_movie_ids: allIds,
      });
      const unswipedSet = new Set<number>(unswipedIds ?? allIds);

      // Also filter out movies swiped optimistically this session
      const newMovies = allMovies.filter(
        (m) => unswipedSet.has(m.id) && !sessionSwipedIds.has(m.id)
      );

      set((state) => ({
        movies: currentCycle === 0 ? newMovies : [...state.movies, ...newMovies],
        feedCycle: currentCycle + 1,
        isLoading: false,
      }));
    } catch (err: any) {
      set({
        isLoading: false,
        loadError: err?.message ?? 'Failed to load movies',
      });
    }
  },

  recordSwipe: async (userId, movieId, liked) => {
    const state = get();

    // Optimistically advance the card
    const nextIndex = state.currentIndex + 1;
    const newLiked = liked
      ? new Set([...state.likedMovieIds, movieId])
      : state.likedMovieIds;
    const newSwiped = new Set([...state.sessionSwipedIds, movieId]);

    set({ currentIndex: nextIndex, likedMovieIds: newLiked, sessionSwipedIds: newSwiped });

    // Prefetch next batch if nearing the end
    const remaining = state.movies.length - nextIndex;
    if (remaining <= PREFETCH_THRESHOLD && !state.isLoading) {
      get().loadMovies();
    }

    // Rate limit: 60 swipes per minute
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_action: 'swipe',
      p_max_count: 60,
      p_window_seconds: 60,
    });
    if (allowed === false) return false;

    const { error } = await supabase
      .from('user_swipes')
      .upsert(
        { user_id: userId, tmdb_movie_id: movieId, liked },
        { onConflict: 'user_id,tmdb_movie_id' }
      );

    if (error) return false;

    // Match detection now runs server-side via Postgres trigger
    // (trg_check_matches_after_swipe). Realtime subscription in
    // useMatchSubscription picks up new connection_matches rows.

    return true;
  },

  reset: () =>
    set({
      movies: [],
      currentIndex: 0,
      feedCycle: 0,
      isLoading: false,
      loadError: null,
      likedMovieIds: new Set(),
      sessionSwipedIds: new Set(),
    }),
}));
