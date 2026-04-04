import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useMatchStore } from '../stores/matchStore';

/**
 * Subscribe to new connection_matches in real-time.
 * When a match is inserted (by the other user's swipe), show a toast.
 */
export function useMatchSubscription() {
  const user = useAuthStore((s) => s.user);
  const setRecentMatch = useMatchStore((s) => s.setRecentMatch);
  const fetchMatchCounts = useMatchStore((s) => s.fetchMatchCounts);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('match-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'connection_matches',
        },
        (payload) => {
          const movieId = payload.new?.tmdb_movie_id;
          if (movieId) {
            setRecentMatch(movieId);
            fetchMatchCounts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
