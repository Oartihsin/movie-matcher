import { create } from 'zustand';
import type { Connection } from '../types/app';
import { supabase } from '../lib/supabase';

interface ConnectionState {
  connections: Connection[];
  pendingCount: number;
  isLoading: boolean;
  loadError: string | null;

  fetchConnections: () => Promise<void>;
  fetchPendingCount: () => Promise<void>;
  sendRequest: (addresseeId: string) => Promise<{ error?: string }>;
  respondToRequest: (connectionId: string, action: 'accepted' | 'blocked') => Promise<{ error?: string }>;
  reset: () => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  pendingCount: 0,
  isLoading: false,
  loadError: null,

  fetchConnections: async () => {
    set({ isLoading: true, loadError: null });
    try {
      const { data, error } = await supabase.rpc('get_connections_for_user');
      if (error) throw error;
      set({ connections: data ?? [], isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, loadError: err?.message ?? 'Failed to load connections' });
    }
  },

  fetchPendingCount: async () => {
    try {
      const { data, error } = await supabase.rpc('get_pending_connection_count');
      if (error) throw error;
      set({ pendingCount: data ?? 0 });
    } catch (err) {
      console.error('Failed to fetch pending count:', err);
    }
  },

  sendRequest: async (addresseeId: string) => {
    try {
      const { data, error } = await supabase.rpc('send_connection_request', {
        p_addressee_id: addresseeId,
      });
      if (error) throw error;
      if (data?.error) return { error: data.error };

      // Refresh connections
      get().fetchConnections();
      return {};
    } catch (err: any) {
      return { error: err.message ?? 'Failed to send request' };
    }
  },

  respondToRequest: async (connectionId: string, action: 'accepted' | 'blocked') => {
    try {
      const { data, error } = await supabase.rpc('respond_to_connection', {
        p_connection_id: connectionId,
        p_action: action,
      });
      if (error) throw error;
      if (data?.error) return { error: data.error };

      // Refresh connections and pending count
      get().fetchConnections();
      get().fetchPendingCount();
      return {};
    } catch (err: any) {
      return { error: err.message ?? 'Failed to respond' };
    }
  },

  reset: () =>
    set({
      connections: [],
      pendingCount: 0,
      isLoading: false,
      loadError: null,
    }),
}));
