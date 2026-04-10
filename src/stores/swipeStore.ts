import { create } from 'zustand';
import type { TMDBMovie } from '../types/tmdb';
import { fetchFeedBatch } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
import { PREFETCH_THRESHOLD } from '../lib/constants';
import { useMatchStore } from './matchStore';

interface SwipeState {
  movies: TMDBMovie[];
  currentIndex: number;
  feedCycle: number;
  isLoading: boolean;
  loadError: string | null;
  likedMovieIds: Set<number>;
  swipedMovieIds: Set<number>;
  preferredGenres: number[];
  preferredLanguages: string[];

  loadMovies: (cycle?: number, genreIds?: number[], languages?: string[]) => Promise<void>;
  setPreferences: (genreIds: number[], languages: string[]) => void;
  loadSwipedIds: (userId: string) => Promise<void>;
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
  swipedMovieIds: new Set(),
  preferredGenres: [],
  preferredLanguages: [],

  setPreferences: (genreIds, languages) => {
    set({ preferredGenres: genreIds, preferredLanguages: languages });
  },

  loadSwipedIds: async (userId: string) => {
    const { data } = await supabase.rpc('get_swiped_movie_ids', {
      p_user_id: userId,
    });
    if (data) {
      set({ swipedMovieIds: new Set(data) });
    }
  },

  loadMovies: async (cycle, genreIds, languages) => {
    set({ isLoading: true, loadError: null });
    try {
      const { preferredGenres, preferredLanguages, feedCycle } = get();
      const genres = genreIds ?? preferredGenres;
      const langs = languages ?? preferredLanguages;
      const currentCycle = cycle ?? feedCycle;

      const allMovies = await fetchFeedBatch(genres, langs, currentCycle);
      const { swipedMovieIds } = get();
      const newMovies = allMovies.filter((m) => !swipedMovieIds.has(m.id));

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
    const newSwiped = new Set([...state.swipedMovieIds, movieId]);

    set({ currentIndex: nextIndex, likedMovieIds: newLiked, swipedMovieIds: newSwiped });

    // Prefetch next batch if nearing the end
    const remaining = state.movies.length - nextIndex;
    if (remaining <= PREFETCH_THRESHOLD && !state.isLoading) {
      get().loadMovies();
    }

    const { error } = await supabase.from('user_swipes').insert({
      user_id: userId,
      tmdb_movie_id: movieId,
      liked,
    });

    if (error) {
      if (error.code === '23505') return false;
      return false;
    }

    if (liked) {
      useMatchStore.getState().checkMatchesForSwipe(userId, movieId);
    }

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
      swipedMovieIds: new Set(),
    }),
}));
