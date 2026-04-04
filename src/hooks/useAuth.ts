import { useEffect } from 'react';
import { Platform } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const {
    user,
    session,
    profile,
    loading,
    isAuthenticated,
    isProfileComplete,
    setSession,
    fetchProfile,
    clearAuth,
  } = useAuthStore();

  // Listen for auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile();
      }
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile();
      } else {
        clearAuth();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signInWithGoogle() {
    const redirectTo =
      Platform.OS === 'web'
        ? window.location.origin
        : makeRedirectUri({ scheme: 'moviematcher' });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    return data;
  }

  async function signInWithApple() {
    const redirectTo =
      Platform.OS === 'web'
        ? window.location.origin
        : makeRedirectUri({ scheme: 'moviematcher' });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo },
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    clearAuth();
  }

  return {
    user,
    session,
    profile,
    loading,
    isAuthenticated,
    isProfileComplete,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signOut,
  };
}
