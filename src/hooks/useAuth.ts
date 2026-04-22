import { useEffect } from 'react';
import { Platform } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
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

  async function signInWithOAuthProvider(provider: 'google' | 'apple') {
    const redirectTo =
      Platform.OS === 'web'
        ? window.location.origin
        : makeRedirectUri({ scheme: 'moviematcher' });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: Platform.OS !== 'web',
      },
    });
    if (error) throw error;

    // On native, open the OAuth URL in an in-app browser
    if (Platform.OS !== 'web' && data.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );
      if (result.type === 'success' && result.url) {
        // Extract tokens from the redirect URL and set the session
        const url = new URL(result.url);
        // Supabase puts tokens in the hash fragment for implicit flow
        const params = new URLSearchParams(
          url.hash ? url.hash.substring(1) : url.search.substring(1)
        );
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
    }

    return data;
  }

  async function signInWithGoogle() {
    return signInWithOAuthProvider('google');
  }

  async function signInWithApple() {
    return signInWithOAuthProvider('apple');
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
