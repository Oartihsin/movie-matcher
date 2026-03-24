import { create } from 'zustand';
import type { TMDBMovie } from '../types/tmdb';
import { fetchPopularMovies } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
import { PREFETCH_THRESHOLD } from '../lib/constants';

interface SwipeState {
  movies: TMDBMovie[];
  currentIndex: number;
  currentPage: number;
  isLoading: boolean;
  likedMovieIds: Set<number>;

  loadMovies: (page: number) => Promise<void>;
  recordSwipe: (roomId: string, userId: string, movieId: number, liked: boolean) => Promise<boolean>;
  reset: () => void;
}

export const useSwipeStore = create<SwipeState>((set, get) => ({
  movies: [],
  currentIndex: 0,
  currentPage: 1,
  isLoading: false,
  likedMovieIds: new Set(),

  loadMovies: async (page: number) => {
    set({ isLoading: true });
    try {
      const newMovies = await fetchPopularMovies(page);
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

  recordSwipe: async (roomId, userId, movieId, liked) => {
    const state = get();

    // Optimistically advance the card
    const nextIndex = state.currentIndex + 1;
    const newLiked = liked
      ? new Set([...state.likedMovieIds, movieId])
      : state.likedMovieIds;

    set({ currentIndex: nextIndex, likedMovieIds: newLiked });

    // Prefetch next page if nearing the end
    const remaining = state.movies.length - nextIndex;
    if (remaining <= PREFETCH_THRESHOLD && !state.isLoading) {
      get().loadMovies(state.currentPage + 1);
    }

    // Record to Supabase
    const { error } = await supabase.from('swipes').insert({
      room_id: roomId,
      user_id: userId,
      tmdb_movie_id: movieId,
      liked,
    });

    if (error) {
      // Ignore duplicate swipe errors (already swiped in a previous session)
      if (error.code === '23505') return false;
      console.error('Swipe insert failed:', error);
      return false;
    }

    // Check if the other user also liked this movie
    if (liked) {
      const { data } = await supabase
        .from('swipes')
        .select('id')
        .eq('room_id', roomId)
        .eq('tmdb_movie_id', movieId)
        .eq('liked', true)
        .neq('user_id', userId)
        .maybeSingle();

      return !!data; // true = it's a match!
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
    }),
}));
