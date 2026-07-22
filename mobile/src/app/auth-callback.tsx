import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function AuthCallbackScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { completeLogin } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Link inválido.');
      return;
    }
    completeLogin(token)
      .then(() => router.replace('/'))
      .catch((err) => setError(err instanceof Error ? err.message : 'Link inválido ou expirado.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText style={styles.text}>{error ?? 'Entrando...'}</ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.four },
  text: { textAlign: 'center' },
});
