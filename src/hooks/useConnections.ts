import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useConnectionStore } from '../stores/connectionStore';
import { useAuthStore } from '../stores/authStore';

export function useConnections() {
  const user = useAuthStore((s) => s.user);
  const {
    connections,
    pendingCount,
    isLoading,
    fetchConnections,
    fetchPendingCount,
    sendRequest,
    respondToRequest,
  } = useConnectionStore();

  // Fetch connections and subscribe to realtime on mount
  useEffect(() => {
    if (!user) return;

    fetchConnections();
    fetchPendingCount();

    // Subscribe to connection changes involving this user
    const channel = supabase
      .channel('connections-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
          filter: `requester_id=eq.${user.id}`,
        },
        () => {
          fetchConnections();
          fetchPendingCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
          filter: `addressee_id=eq.${user.id}`,
        },
        () => {
          fetchConnections();
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const accepted = connections.filter((c) => c.status === 'accepted');
  const pendingIncoming = connections.filter(
    (c) => c.status === 'pending' && c.addressee_id === user?.id
  );
  const pendingSent = connections.filter(
    (c) => c.status === 'pending' && c.requester_id === user?.id
  );

  return {
    connections,
    accepted,
    pendingIncoming,
    pendingSent,
    pendingCount,
    isLoading,
    sendRequest,
    respondToRequest,
    refresh: fetchConnections,
  };
}
