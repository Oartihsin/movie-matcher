import { Redirect } from 'expo-router';

export default function RootIndex() {
  // Root index just redirects — actual routing logic is in _layout.tsx
  return <Redirect href="/(auth)/login" />;
}
