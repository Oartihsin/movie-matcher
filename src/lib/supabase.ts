import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants';
import { Platform } from 'react-native';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const isWeb = Platform.OS === 'web';

  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // On web, use localStorage (default). On native, use AsyncStorage.
      ...(isWeb ? {} : { storage: AsyncStorage }),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return _supabase;
}

// Lazy getter that's safe for SSR — only initializes on client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop];
  },
});
