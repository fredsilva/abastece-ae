import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/auth';
import { submitRating } from '@/lib/api';

const CATEGORIES: { key: 'price' | 'quality' | 'service'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'price', label: 'Preço', icon: 'pricetag-outline' },
  { key: 'quality', label: 'Qualidade', icon: 'water-outline' },
  { key: 'service', label: 'Atendimento', icon: 'people-outline' },
];

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} hitSlop={6}>
          <Ionicons name={star <= value ? 'star' : 'star-outline'} size={30} color="#f59e0b" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function RateStationScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const params = useLocalSearchParams<{
    fillUpId: string;
    stationName: string;
    priceStatus: 'accepted' | 'pending_review';
  }>();

  const [stars, setStars] = useState<Record<'price' | 'quality' | 'service', number>>({
    price: 0,
    quality: 0,
    service: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = stars.price > 0 && stars.quality > 0 && stars.service > 0;

  async function handleSubmit() {
    if (!accessToken || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitRating(accessToken, {
        fillUpId: params.fillUpId,
        priceStars: stars.price,
        qualityStars: stars.quality,
        serviceStars: stars.service,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar a avaliação');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.resultSafeArea}>
          <View style={styles.resultIcon}>
            <Ionicons name="checkmark" size={32} color="#ffffff" />
          </View>
          <Text style={styles.resultTitle}>Obrigado pela avaliação!</Text>
          <Text style={styles.resultText}>
            {params.priceStatus === 'pending_review'
              ? 'Seu abastecimento foi registrado e a nota do posto já foi atualizada. O preço ficou fora da faixa esperada, então nossa equipe vai revisar antes de publicar.'
              : 'Seu abastecimento foi registrado, o preço já está valendo na lista e a nota do posto foi atualizada.'}
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.dismissTo('/')}>
            <Text style={styles.primaryButtonText}>Voltar à lista</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#111111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Avaliar posto</Text>
          <View style={styles.backButton} />
        </View>

        <Text style={styles.stationName} numberOfLines={2}>
          {params.stationName}
        </Text>
        <Text style={styles.subtitle}>Como foi seu abastecimento?</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {CATEGORIES.map((cat) => (
          <View key={cat.key} style={styles.categoryRow}>
            <View style={styles.categoryLabel}>
              <Ionicons name={cat.icon} size={18} color="#6b7280" />
              <Text style={styles.categoryLabelText}>{cat.label}</Text>
            </View>
            <StarRow value={stars[cat.key]} onChange={(v) => setStars((s) => ({ ...s, [cat.key]: v }))} />
          </View>
        ))}

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
          disabled={!canSubmit || submitting}
          onPress={handleSubmit}
        >
          {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Enviar avaliação</Text>}
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
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },

  error: { color: '#ef4444', marginTop: 16, fontSize: 13 },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 18,
    marginTop: 8,
  },
  categoryLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryLabelText: { fontSize: 15, fontWeight: '600', color: '#111111' },
  starRow: { flexDirection: 'row', gap: 4 },

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

  resultSafeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  resultIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#10b981',
  },
  resultTitle: { fontSize: 20, fontWeight: '700', color: '#111111', textAlign: 'center' },
  resultText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8, marginBottom: 32, lineHeight: 20 },
});
