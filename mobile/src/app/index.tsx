import { StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Abastece Aê
        </ThemedText>
        <ThemedText style={styles.text}>Logado como {user?.email}</ThemedText>

        <TouchableOpacity style={styles.button} onPress={logout}>
          <ThemedText style={styles.buttonText}>Sair</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  title: { fontSize: 32, lineHeight: 40 },
  text: { textAlign: 'center' },
  button: {
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
});
