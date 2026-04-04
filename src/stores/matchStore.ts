import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface MatchCounts {
  [connectionId: string]: number;
}

interface MatchedMovie {
  tmdb_movie_id: number;
  matched_at: string;
}

interface MatchState {
  matchCounts: MatchCounts;
  currentMatches: MatchedMovie[];
  isLoading: boolean;
  recentMatchMovieId: number | null;

  fetchMatchCounts: () => Promise<void>;
  fetchMatchesForConnection: (connectionId: string) => Promise<void>;
  checkMatchesForSwipe: (userId: string, movieId: number) => Promise<number>;
  setRecentMatch: (movieId: number | null) => void;
  reset: () => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matchCounts: {},
  currentMatches: [],
  isLoading: false,
  recentMatchMovieId: null,

  fetchMatchCounts: async () => {
    try {
      const { data, error } = await supabase.rpc('get_match_counts');
      if (error) throw error;
      const counts: MatchCounts = {};
      (data ?? []).forEach((row: { connection_id: string; match_count: number }) => {
        counts[row.connection_id] = Number(row.match_count);
      });
      set({ matchCounts: counts });
    } catch (err) {
      console.error('Failed to fetch match counts:', err);
    }
  },

  fetchMatchesForConnection: async (connectionId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.rpc('get_matches_for_connection', {
        p_connection_id: connectionId,
      });
      if (error) throw error;
      set({ currentMatches: data ?? [], isLoading: false });
    } catch (err) {
      console.error('Failed to fetch matches:', err);
      set({ isLoading: false });
    }
  },

  checkMatchesForSwipe: async (userId: string, movieId: number) => {
    try {
      const { data, error } = await supabase.rpc('check_matches_for_swipe', {
        p_user_id: userId,
        p_movie_id: movieId,
      });
      if (error) throw error;
      const count = data ?? 0;
      if (count > 0) {
        set({ recentMatchMovieId: movieId });
        get().fetchMatchCounts();
      }
      return count;
    } catch (err) {
      console.error('Failed to check matches:', err);
      return 0;
    }
  },

  setRecentMatch: (movieId) => set({ recentMatchMovieId: movieId }),

  reset: () =>
    set({
      matchCounts: {},
      currentMatches: [],
      isLoading: false,
      recentMatchMovieId: null,
    }),
}));
