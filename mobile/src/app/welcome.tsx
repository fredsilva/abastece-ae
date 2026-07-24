import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { Spacing } from '@/constants/theme';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'pricetag-outline', label: 'Compare preços\nem tempo real' },
  { icon: 'location-outline', label: 'Encontre postos\nperto de você' },
  { icon: 'star-outline', label: 'Economize\nsempre' },
];

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.logoBadge}>
          <MaterialCommunityIcons name="gas-station" size={40} color="#ffffff" />
          <View style={styles.logoAccent} />
        </View>

        <Text style={styles.title}>
          Abastece <Text style={styles.titleAccent}>Aê</Text>
        </Text>
        <Text style={styles.subtitle}>Encontre o posto de combustível mais barato perto de você.</Text>

        <View style={styles.mapCard}>
          <View style={[styles.mapBlob, styles.mapBlobGreen]} />
          <View style={[styles.mapBlob, styles.mapBlobBlue]} />

          <View style={styles.centerPin}>
            <View style={styles.centerPinCore} />
          </View>

          <View style={[styles.pricePill, styles.pricePillCheapest, styles.pinTopLeft]}>
            <Text style={styles.pricePillTextCheapest}>R$ 5,79</Text>
          </View>
          <View style={[styles.pricePill, styles.pinTopRight]}>
            <Text style={styles.pricePillText}>R$ 5,89</Text>
          </View>
          <View style={[styles.pricePill, styles.pinBottomRight]}>
            <Text style={styles.pricePillText}>R$ 5,94</Text>
          </View>
          <View style={styles.userDot} />
        </View>

        <View style={styles.featureRow}>
          {FEATURES.map((feature) => (
            <View key={feature.label} style={styles.featureItem}>
              <View style={styles.featureIconCircle}>
                <Ionicons name={feature.icon} size={22} color="#3b82f6" />
              </View>
              <Text style={styles.featureLabel}>{feature.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.spacer} />

        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <TouchableOpacity style={styles.cta} onPress={() => router.push('/login')}>
          <Text style={styles.ctaText}>Começar agora</Text>
        </TouchableOpacity>
        <Text style={styles.footer}>É rápido, fácil e gratuito.</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  safeArea: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.five },

  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  logoAccent: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10b981',
    borderWidth: 3,
    borderColor: '#ffffff',
  },

  title: { fontSize: 32, fontWeight: '700', color: '#111111' },
  titleAccent: { color: '#3b82f6' },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    lineHeight: 21,
  },

  mapCard: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    backgroundColor: '#f3f6fa',
    marginTop: Spacing.five,
    overflow: 'hidden',
  },
  mapBlob: { position: 'absolute', borderRadius: 9999, opacity: 0.5 },
  mapBlobGreen: { width: 140, height: 140, backgroundColor: '#d1fae5', top: -30, left: -30 },
  mapBlobBlue: { width: 120, height: 120, backgroundColor: '#dbeafe', bottom: -40, right: -20 },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -22,
    marginLeft: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  centerPinCore: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ffffff' },
  pricePill: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pricePillCheapest: { backgroundColor: '#10b981' },
  pricePillText: { fontSize: 13, fontWeight: '700', color: '#111111' },
  pricePillTextCheapest: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  pinTopLeft: { top: 24, left: 16 },
  pinTopRight: { top: 16, right: 16 },
  pinBottomRight: { bottom: 28, right: 40 },
  userDot: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.five,
    paddingHorizontal: Spacing.two,
  },
  featureItem: { alignItems: 'center', flex: 1, gap: 8 },
  featureIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureLabel: { fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 16 },

  spacer: { flex: 1 },

  dots: { flexDirection: 'row', gap: 6, marginBottom: Spacing.three },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e5e7eb' },
  dotActive: { width: 20, backgroundColor: '#3b82f6' },

  cta: {
    width: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  footer: { fontSize: 12, color: '#9ca3af', marginTop: Spacing.two, marginBottom: Spacing.three },
});
