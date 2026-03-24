import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // Retry loop — Expo Go's network stack can take a moment after simulator boot
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            setUserId(session.user.id);
            setLoading(false);
            return;
          }

          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          setUserId(data.user?.id ?? null);
          setLoading(false);
          return;
        } catch (err) {
          console.warn(`Auth attempt ${attempt}/${MAX_RETRIES} failed:`, err);
          if (attempt < MAX_RETRIES) {
            await wait(RETRY_DELAY_MS);
          } else {
            console.error('Auth failed after all retries:', err);
            setLoading(false);
          }
        }
      }
    }
    init();
  }, []);

  return { userId, loading };
}
