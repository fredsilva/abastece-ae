import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';

import { AuthProvider, useAuth } from '@/context/auth';
import { FavoritesProvider } from '@/context/favorites';
import { registerForPushNotifications } from '@/lib/notifications';

function RootNavigation() {
  const { user, accessToken, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthFlow = segments[0] === 'welcome' || segments[0] === 'login' || segments[0] === 'auth-callback';
    if (!user && !inAuthFlow) {
      router.replace('/welcome');
    } else if (user && inAuthFlow) {
      router.replace('/');
    }
  }, [user, loading, segments]);

  useEffect(() => {
    if (accessToken) {
      registerForPushNotifications(accessToken);
    }
  }, [accessToken]);

  if (loading) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <FavoritesProvider>
        <RootNavigation />
      </FavoritesProvider>
    </AuthProvider>
  );
}
