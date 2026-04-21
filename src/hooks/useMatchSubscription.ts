import { useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useMatchStore } from '../stores/matchStore';
import { useConnectionStore } from '../stores/connectionStore';

/**
 * Subscribe to new connection_matches in real-time.
 * Scoped to the current user's accepted connections so we only receive
 * relevant match notifications — not every match on the platform.
 */
export function useMatchSubscription() {
  const user = useAuthStore((s) => s.user);
  const setRecentMatch = useMatchStore((s) => s.setRecentMatch);
  const fetchMatchCounts = useMatchStore((s) => s.fetchMatchCounts);
  const connections = useConnectionStore((s) => s.connections);

  const acceptedIds = useMemo(
    () => connections.filter((c) => c.status === 'accepted').map((c) => c.id),
    [connections]
  );

  useEffect(() => {
    if (!user || acceptedIds.length === 0) return;

    let channel = supabase.channel('match-notifications');

    for (const connId of acceptedIds) {
      channel = channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'connection_matches',
          filter: `connection_id=eq.${connId}`,
        },
        (payload) => {
          const movieId = payload.new?.tmdb_movie_id;
          if (movieId) {
            setRecentMatch(movieId);
            fetchMatchCounts();
          }
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, acceptedIds.join(',')]);
}
