import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';

import { AuthProvider, useAuth } from '@/context/auth';

function RootNavigation() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthFlow = segments[0] === 'login' || segments[0] === 'auth-callback';
    if (!user && !inAuthFlow) {
      router.replace('/login');
    } else if (user && inAuthFlow) {
      router.replace('/');
    }
  }, [user, loading, segments]);

  if (loading) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}
