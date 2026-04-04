import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';

export default function AppLayout() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isProfileComplete = useAuthStore((s) => s.isProfileComplete);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace('/(auth)/login');
      return;
    }

    if (!isProfileComplete) {
      router.replace('/(auth)/onboarding');
      return;
    }
  }, [isAuthenticated, isProfileComplete, loading]);

  if (loading || !isAuthenticated || !isProfileComplete) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#16213e' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Movie Matcher', headerShown: false }}
      />
      <Stack.Screen
        name="profile"
        options={{ title: 'Profile', presentation: 'modal' }}
      />
      <Stack.Screen
        name="connections/index"
        options={{ title: 'Connections' }}
      />
      <Stack.Screen
        name="connections/[connectionId]"
        options={{ title: 'Matches' }}
      />
      <Stack.Screen
        name="user/[username]"
        options={{ title: 'Profile' }}
      />
    </Stack>
  );
}
