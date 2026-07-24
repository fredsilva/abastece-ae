import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function AccountScreen() {
  const router = useRouter();
  const { user, logout, deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);

  function confirmDeleteAccount() {
    Alert.alert(
      'Excluir sua conta?',
      'Isso apaga seu login, favoritos e notificações salvas imediatamente. Preços e avaliações que você contribuiu continuam no histórico da comunidade, sem ligação com sua identidade. Essa ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir conta', style: 'destructive', onPress: handleDeleteAccount },
      ]
    );
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível excluir sua conta agora.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#111111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Minha conta</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={26} color="#3b82f6" />
          </View>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/privacy-policy')}>
            <Ionicons name="document-text-outline" size={20} color="#374151" />
            <Text style={styles.rowText}>Política de privacidade</Text>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color="#374151" />
            <Text style={styles.rowText}>Sair</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dangerSection}>
          <Text style={styles.dangerLabel}>Zona de risco</Text>
          <TouchableOpacity style={styles.dangerRow} onPress={confirmDeleteAccount} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator color="#ef4444" />
            ) : (
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            )}
            <Text style={styles.dangerText}>Excluir minha conta</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: Spacing.four,
  },
  backButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111111' },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.four,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  email: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111111' },

  section: {
    marginTop: Spacing.five,
    marginHorizontal: Spacing.four,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f2f4',
  },
  rowText: { flex: 1, fontSize: 15, color: '#111111', fontWeight: '500' },

  dangerSection: { marginTop: Spacing.five, marginHorizontal: Spacing.four },
  dangerLabel: { fontSize: 12, fontWeight: '700', color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase' },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: Spacing.three,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  dangerText: { fontSize: 15, color: '#ef4444', fontWeight: '600' },
});
