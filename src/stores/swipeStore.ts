import { create } from 'zustand';
import type { TMDBMovie } from '../types/tmdb';
import { fetchPopularMovies } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
import { PREFETCH_THRESHOLD } from '../lib/constants';
import { useMatchStore } from './matchStore';

interface SwipeState {
  movies: TMDBMovie[];
  currentIndex: number;
  currentPage: number;
  isLoading: boolean;
  likedMovieIds: Set<number>;
  swipedMovieIds: Set<number>;

  loadMovies: (page: number) => Promise<void>;
  loadSwipedIds: (userId: string) => Promise<void>;
  recordSwipe: (userId: string, movieId: number, liked: boolean) => Promise<boolean>;
  reset: () => void;
}

export const useSwipeStore = create<SwipeState>((set, get) => ({
  movies: [],
  currentIndex: 0,
  currentPage: 1,
  isLoading: false,
  likedMovieIds: new Set(),
  swipedMovieIds: new Set(),

  loadSwipedIds: async (userId: string) => {
    const { data } = await supabase.rpc('get_swiped_movie_ids', {
      p_user_id: userId,
    });
    if (data) {
      set({ swipedMovieIds: new Set(data) });
    }
  },

  loadMovies: async (page: number) => {
    set({ isLoading: true });
    try {
      const allMovies = await fetchPopularMovies(page);
      const { swipedMovieIds } = get();
      // Filter out already-swiped movies
      const newMovies = allMovies.filter((m) => !swipedMovieIds.has(m.id));
      set((state) => ({
        movies: page === 1 ? newMovies : [...state.movies, ...newMovies],
        currentPage: page,
        isLoading: false,
      }));
    } catch (err) {
      console.error('Failed to load movies:', err);
      set({ isLoading: false });
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

    // Prefetch next page if nearing the end
    const remaining = state.movies.length - nextIndex;
    if (remaining <= PREFETCH_THRESHOLD && !state.isLoading) {
      get().loadMovies(state.currentPage + 1);
    }

    // Record to Supabase (user_swipes table — global, no room_id)
    const { error } = await supabase.from('user_swipes').insert({
      user_id: userId,
      tmdb_movie_id: movieId,
      liked,
    });

    if (error) {
      // Ignore duplicate swipe errors
      if (error.code === '23505') return false;
      console.error('Swipe insert failed:', error);
      return false;
    }

    // Check for matches with connections if liked
    if (liked) {
      useMatchStore.getState().checkMatchesForSwipe(userId, movieId);
    }

    return false;
  },

  reset: () =>
    set({
      movies: [],
      currentIndex: 0,
      currentPage: 1,
      isLoading: false,
      likedMovieIds: new Set(),
      swipedMovieIds: new Set(),
    }),
}));
