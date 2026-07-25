import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { StationCard } from '@/components/StationCard';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchFavorites, type FuelType, type Station } from '@/lib/api';
import { computePriceTiers } from '@/lib/priceTier';

const FUEL_TABS: { key: FuelType; label: string }[] = [
  { key: 'gasolina', label: 'Gasolina' },
  { key: 'etanol', label: 'Etanol' },
  { key: 'diesel', label: 'Diesel' },
];

export default function FavoritesScreen() {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [selectedFuel, setSelectedFuel] = useState<FuelType>(user?.defaultFuelTab ?? 'gasolina');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch {
        // segue sem localização — a lista funciona sem distância
      }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const result = await fetchFavorites(accessToken, {
        fuel: selectedFuel,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      setStations(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar favoritos');
    }
  }, [accessToken, selectedFuel, coords]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  function handleStationPress(station: Station) {
    router.push({
      pathname: '/station-detail',
      params: {
        station: JSON.stringify(station),
        fuel: selectedFuel,
        ...(coords ? { userLat: String(coords.latitude), userLng: String(coords.longitude) } : {}),
      },
    });
  }

  const cheapestPrice = stations.length > 0 ? Math.min(...stations.map((s) => s.price)) : 0;
  const priceTiers = useMemo(() => computePriceTiers(stations), [stations]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#111111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Favoritos</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.tabGroup}>
          {FUEL_TABS.map((tab) => {
            const active = tab.key === selectedFuel;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setSelectedFuel(tab.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.centerFill}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={stations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <StationCard
                station={item}
                cheapestPrice={cheapestPrice}
                tier={priceTiers.get(item.id)}
                onPress={() => handleStationPress(item)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={40} color="#d1d5db" />
                <Text style={styles.emptyText}>
                  Você ainda não favoritou nenhum posto. Toque no coração na tela do posto pra acompanhar o preço aqui.
                </Text>
              </View>
            }
            contentContainerStyle={styles.list}
          />
        )}
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

  tabGroup: {
    flexDirection: 'row',
    backgroundColor: '#eef0f2',
    borderRadius: 9999,
    padding: 4,
    gap: 4,
    marginTop: Spacing.three,
    marginHorizontal: Spacing.four,
  },
  tab: { flex: 1, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9999, alignItems: 'center' },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#ffffff' },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four },
  error: { color: '#ef4444', textAlign: 'center' },

  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.six },
  emptyState: { alignItems: 'center', paddingTop: Spacing.six, paddingHorizontal: Spacing.four },
  emptyText: { color: '#6b7280', textAlign: 'center', marginTop: Spacing.three, lineHeight: 20 },
});
