import { create } from 'zustand';
import type { TMDBMovie } from '../types/tmdb';

interface MatchEntry {
  tmdbMovieId: number;
  movie?: TMDBMovie;
  matchedAt: string;
}

interface MatchState {
  matches: MatchEntry[];
  newMatchMovieId: number | null;
  addMatch: (tmdbMovieId: number, movie?: TMDBMovie) => void;
  setNewMatchMovieId: (id: number | null) => void;
  setMovieForMatch: (tmdbMovieId: number, movie: TMDBMovie) => void;
  reset: () => void;
}

export const useMatchStore = create<MatchState>((set) => ({
  matches: [],
  newMatchMovieId: null,

  addMatch: (tmdbMovieId, movie) =>
    set((state) => {
      if (state.matches.some((m) => m.tmdbMovieId === tmdbMovieId)) {
        return state; // Already tracked
      }
      return {
        matches: [
          { tmdbMovieId, movie, matchedAt: new Date().toISOString() },
          ...state.matches,
        ],
      };
    }),

  setNewMatchMovieId: (id) => set({ newMatchMovieId: id }),

  setMovieForMatch: (tmdbMovieId, movie) =>
    set((state) => ({
      matches: state.matches.map((m) =>
        m.tmdbMovieId === tmdbMovieId ? { ...m, movie } : m
      ),
    })),

  reset: () => set({ matches: [], newMatchMovieId: null }),
}));
