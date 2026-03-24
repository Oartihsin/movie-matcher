import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ROOM_CODE_LENGTH, ROOM_CODE_CHARS } from '../lib/constants';
import type { Room } from '../types/app';

function generateRoomCode(): string {
  return Array.from({ length: ROOM_CODE_LENGTH }, () =>
    ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  ).join('');
}

export function useRoom() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom(userId: string): Promise<Room | null> {
    setLoading(true);
    setError(null);
    try {
      const code = generateRoomCode();

      // Use RPC to create room + add member atomically, bypassing RLS issues
      const { data, error: rpcError } = await supabase.rpc('create_room', {
        p_code: code,
        p_user_id: userId,
      });

      if (rpcError) throw rpcError;

      return data as Room;
    } catch (err: any) {
      console.error('createRoom error:', err);
      setError(err.message ?? 'Failed to create room');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom(code: string, userId: string): Promise<Room | null> {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('join_room', {
        p_code: code.toUpperCase(),
        p_user_id: userId,
      });

      if (rpcError) throw rpcError;
      if (!data) {
        setError('Room not found or full');
        return null;
      }

      return data as Room;
    } catch (err: any) {
      console.error('joinRoom error:', err);
      setError(err.message ?? 'Failed to join room');
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { createRoom, joinRoom, loading, error };
}
