import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '../types/app';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isProfileComplete: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: () => Promise<Profile | null>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  isProfileComplete: false,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session?.user,
      loading: false,
    }),

  setProfile: (profile) =>
    set({
      profile,
      isProfileComplete: !!profile && !profile.username.startsWith('user_'),
    }),

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      if (__DEV__) console.error('Failed to fetch profile:', error);
      return null;
    }

    const profile = data as Profile | null;
    set({
      profile,
      isProfileComplete: !!profile && !profile.username.startsWith('user_'),
    });
    return profile;
  },

  clearAuth: () =>
    set({
      user: null,
      session: null,
      profile: null,
      loading: false,
      isAuthenticated: false,
      isProfileComplete: false,
    }),
}));
