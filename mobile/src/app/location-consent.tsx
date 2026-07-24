import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { Spacing } from '@/constants/theme';
import { secureStorage } from '@/lib/secure-storage';

export const LOCATION_CONSENT_SEEN_KEY = 'abasteceae_location_consent_seen';

export default function LocationConsentScreen() {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);

  async function proceed() {
    await secureStorage.setItemAsync(LOCATION_CONSENT_SEEN_KEY, '1');
    router.replace('/');
  }

  async function handleAllow() {
    setRequesting(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } finally {
      setRequesting(false);
      await proceed();
    }
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.iconCircle}>
          <Ionicons name="location" size={32} color="#3b82f6" />
        </View>

        <Text style={styles.title}>Usar sua localização?</Text>
        <Text style={styles.text}>
          O Abastece Aê usa sua localização, só enquanto o app está aberto, para:
        </Text>

        <View style={styles.reasonList}>
          <View style={styles.reasonItem}>
            <Ionicons name="pin-outline" size={18} color="#3b82f6" />
            <Text style={styles.reasonText}>Mostrar os postos mais próximos de você primeiro</Text>
          </View>
          <View style={styles.reasonItem}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#3b82f6" />
            <Text style={styles.reasonText}>Confirmar que um "Abasteci aqui" ou report de preço foi feito no posto certo</Text>
          </View>
        </View>

        <Text style={styles.footnote}>
          Não monitoramos sua localização em segundo plano. Se você não permitir, o app continua funcionando — só sem
          ordenação por distância.
        </Text>

        <View style={styles.spacer} />

        <TouchableOpacity style={styles.primaryButton} disabled={requesting} onPress={handleAllow}>
          <Text style={styles.primaryButtonText}>{requesting ? 'Aguarde...' : 'Permitir localização'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} disabled={requesting} onPress={proceed}>
          <Text style={styles.secondaryButtonText}>Agora não</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
          <Text style={styles.link}>Ver política de privacidade</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.six, alignItems: 'center' },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },

  title: { fontSize: 22, fontWeight: '700', color: '#111111', textAlign: 'center' },
  text: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: Spacing.two,
    lineHeight: 20,
  },

  reasonList: { width: '100%', marginTop: Spacing.four, gap: Spacing.three },
  reasonItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reasonText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },

  footnote: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: Spacing.four, lineHeight: 17 },

  spacer: { flex: 1 },

  primaryButton: {
    width: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { width: '100%', paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#6b7280', fontSize: 15, fontWeight: '600' },

  link: { color: '#3b82f6', fontSize: 13, fontWeight: '600', marginTop: Spacing.two, marginBottom: Spacing.three },
});
