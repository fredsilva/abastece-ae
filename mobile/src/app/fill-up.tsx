import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/auth';
import { submitFillUp, type FuelType } from '@/lib/api';
import { getDeviceId } from '@/lib/device-id';

const FUEL_LABELS: Record<FuelType, string> = {
  gasolina: 'Gasolina',
  etanol: 'Etanol',
  diesel: 'Diesel',
};

export default function FillUpScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const params = useLocalSearchParams<{
    stationId: string;
    stationName: string;
    fuel: FuelType;
    currentPrice: string;
  }>();

  const [price, setPrice] = useState(params.currentPrice?.replace('.', ',') ?? '');
  const [liters, setLiters] = useState('');
  const [pixDiscount, setPixDiscount] = useState(false);
  const [cashDiscount, setCashDiscount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceValue = Number(price.replace(',', '.'));
  const litersValue = Number(liters.replace(',', '.'));
  const canSubmit =
    price.trim().length > 0 &&
    Number.isFinite(priceValue) &&
    priceValue > 0 &&
    liters.trim().length > 0 &&
    Number.isFinite(litersValue) &&
    litersValue > 0;

  async function handleSubmit() {
    if (!accessToken || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
      if (permissionStatus !== 'granted') {
        setError('Precisamos da sua localização para confirmar que você está no posto.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const deviceId = await getDeviceId();

      const res = await submitFillUp(accessToken, {
        gasStationId: params.stationId,
        fuelType: params.fuel,
        price: priceValue,
        liters: litersValue,
        pixDiscount,
        cashDiscount,
        deviceId,
        gpsLat: position.coords.latitude,
        gpsLng: position.coords.longitude,
      });

      router.replace({
        pathname: '/rate-station',
        params: { fillUpId: res.fillUpId, stationName: params.stationName, priceStatus: res.status },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar o abastecimento');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#111111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Abasteci aqui</Text>
          <View style={styles.backButton} />
        </View>

        <Text style={styles.stationName} numberOfLines={1}>
          {params.stationName}
        </Text>
        <Text style={styles.fuelLabel}>{FUEL_LABELS[params.fuel]}</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.fieldLabel}>Preço por litro</Text>
        <View style={styles.inputRow}>
          <Text style={styles.inputPrefix}>R$</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0,00"
            style={styles.input}
            autoFocus
          />
        </View>

        <Text style={styles.fieldLabel}>Litros abastecidos</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={liters}
            onChangeText={setLiters}
            keyboardType="decimal-pad"
            placeholder="0,00"
            style={[styles.input, styles.inputNoPrefix]}
          />
          <Text style={styles.inputSuffix}>L</Text>
        </View>

        <Text style={styles.fieldLabel}>Desconto</Text>
        <View style={styles.discountRow}>
          <TouchableOpacity
            style={[styles.discountChip, pixDiscount && styles.discountChipActive]}
            onPress={() => setPixDiscount((v) => !v)}
          >
            <Ionicons name="qr-code-outline" size={16} color={pixDiscount ? '#ffffff' : '#6b7280'} />
            <Text style={[styles.discountChipText, pixDiscount && styles.discountChipTextActive]}>Pix</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.discountChip, cashDiscount && styles.discountChipActive]}
            onPress={() => setCashDiscount((v) => !v)}
          >
            <Ionicons name="cash-outline" size={16} color={cashDiscount ? '#ffffff' : '#6b7280'} />
            <Text style={[styles.discountChipText, cashDiscount && styles.discountChipTextActive]}>Dinheiro</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gpsNote}>
          <Ionicons name="location" size={14} color="#6b7280" />
          <Text style={styles.gpsNoteText}>Vamos confirmar sua localização pra validar o abastecimento</Text>
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
          disabled={!canSubmit || submitting}
          onPress={handleSubmit}
        >
          {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Confirmar abastecimento</Text>}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  safeArea: { flex: 1, paddingHorizontal: 20 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  backButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111111' },

  stationName: { fontSize: 20, fontWeight: '700', color: '#111111', marginTop: 20 },
  fuelLabel: { fontSize: 14, color: '#6b7280', marginTop: 2 },

  error: { color: '#ef4444', marginTop: 16, fontSize: 13 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginTop: 24, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  inputPrefix: { fontSize: 22, fontWeight: '700', color: '#6b7280' },
  inputSuffix: { fontSize: 18, fontWeight: '700', color: '#6b7280' },
  input: { flex: 1, fontSize: 28, fontWeight: '700', color: '#111111', paddingVertical: 14 },
  inputNoPrefix: { paddingLeft: 0 },

  discountRow: { flexDirection: 'row', gap: 10 },
  discountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  discountChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  discountChipText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  discountChipTextActive: { color: '#ffffff' },

  gpsNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20 },
  gpsNoteText: { fontSize: 12, color: '#6b7280', flex: 1 },

  spacer: { flex: 1 },

  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonDisabled: { backgroundColor: '#93c5fd' },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
