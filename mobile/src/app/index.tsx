import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { StationCard } from '@/components/StationCard';
import { StationMapPreview } from '@/components/StationMapPreview';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchStations, type FuelType, type Station } from '@/lib/api';
import { computePriceTiers } from '@/lib/priceTier';

const FUEL_TABS: { key: FuelType; label: string }[] = [
  { key: 'gasolina', label: 'Gasolina' },
  { key: 'etanol', label: 'Etanol' },
  { key: 'diesel', label: 'Diesel' },
];
const FUEL_ORDER: FuelType[] = FUEL_TABS.map((tab) => tab.key);

// O mapa ocupa uma fração fixa da altura da tela (não medida dinamicamente), pra não "pular"
// de tamanho quando a tela abre ou quando o combustível muda.
const MAP_HEIGHT_RATIO = 0.45;

type SortMode = 'best' | 'price' | 'distance';

const SORT_OPTIONS: { key: SortMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'best', label: 'Melhor custo-benefício', icon: 'sparkles-outline' },
  { key: 'price', label: 'Preço', icon: 'pricetag-outline' },
  { key: 'distance', label: 'Proximidade', icon: 'location-outline' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selectedFuel, setSelectedFuel] = useState<FuelType>(user?.defaultFuelTab ?? 'gasolina');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('best');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch {
        // segue sem localização — o ranking funciona sem distância
      }
    })();
  }, []);

  const loadStations = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchStations({
        fuel: selectedFuel,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      setStations(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar os postos');
    }
  }, [selectedFuel, coords]);

  useEffect(() => {
    setLoading(true);
    loadStations().finally(() => setLoading(false));
  }, [loadStations]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadStations();
    setRefreshing(false);
  }

  function handleProfilePress() {
    router.push('/account');
  }

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

  const changeFuel = useCallback((direction: 1 | -1) => {
    setSelectedFuel((current) => {
      const index = FUEL_ORDER.indexOf(current);
      const nextIndex = index + direction;
      return nextIndex < 0 || nextIndex >= FUEL_ORDER.length ? current : FUEL_ORDER[nextIndex];
    });
  }, []);

  // Swipe pra esquerda avança pro próximo combustível (Gasolina → Etanol → Diesel), swipe pra
  // direita volta — mesmo efeito prático de tocar nas abas flutuantes.
  const swipeGesture = useMemo(
    () =>
      Gesture.Race(
        Gesture.Fling()
          .direction(Directions.LEFT)
          .onEnd(() => runOnJS(changeFuel)(1)),
        Gesture.Fling()
          .direction(Directions.RIGHT)
          .onEnd(() => runOnJS(changeFuel)(-1))
      ),
    [changeFuel]
  );

  const priceTiers = useMemo(() => computePriceTiers(stations), [stations]);
  const cheapestPrice = useMemo(
    () => (stations.length > 0 ? Math.min(...stations.map((s) => s.price)) : 0),
    [stations]
  );
  const cityLabel = stations[0] ? `${stations[0].city} - ${stations[0].state}` : null;
  const sortedStations = useMemo(() => {
    if (sortMode === 'price') return [...stations].sort((a, b) => a.price - b.price);
    if (sortMode === 'distance') {
      return [...stations].sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
    }
    return stations;
  }, [stations, sortMode]);

  const mapHeight = windowHeight * MAP_HEIGHT_RATIO;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="gas-station" size={18} color="#ffffff" />
            </View>
            <Text style={styles.wordmark}>
              Abastece <Text style={styles.wordmarkAccent}>Aê</Text>
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/favorites')}>
              <Ionicons name="heart-outline" size={18} color="#111111" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileButton} onPress={handleProfilePress}>
              <Ionicons name="person-outline" size={18} color="#111111" />
            </TouchableOpacity>
          </View>
        </View>

        {cityLabel && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#6b7280" />
            <Text style={styles.locationText}>{cityLabel}</Text>
          </View>
        )}

        <View style={[styles.mapWrap, { height: mapHeight }]}>
          {stations.length > 0 && (
            <StationMapPreview
              stations={stations}
              tiers={priceTiers}
              userCoords={coords}
              onStationPress={handleStationPress}
            />
          )}
        </View>

        <GestureDetector gesture={swipeGesture}>
          <View style={styles.listArea}>
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
                data={sortedStations}
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
                  <Text style={styles.emptyText}>Nenhum posto com preço de {selectedFuel} cadastrado ainda.</Text>
                }
                contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              />
            )}
          </View>
        </GestureDetector>
      </SafeAreaView>

      <View style={[styles.floatingTabBarWrap, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <View style={styles.floatingTabBar}>
          {FUEL_TABS.map((tab) => {
            const active = tab.key === selectedFuel;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.floatingTab, active && styles.floatingTabActive]}
                onPress={() => setSelectedFuel(tab.key)}
              >
                <Text style={[styles.floatingTabText, active && styles.floatingTabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Modal visible={sortMenuOpen} transparent animationType="fade" onRequestClose={() => setSortMenuOpen(false)}>
        <Pressable style={styles.sortBackdrop} onPress={() => setSortMenuOpen(false)}>
          <Pressable style={styles.sortSheet}>
            <Text style={styles.sortSheetTitle}>Ordenar por</Text>
            {SORT_OPTIONS.map((opt) => {
              const active = opt.key === sortMode;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={styles.sortOption}
                  onPress={() => {
                    setSortMode(opt.key);
                    setSortMenuOpen(false);
                  }}
                >
                  <Ionicons name={opt.icon} size={18} color={active ? '#3b82f6' : '#6b7280'} />
                  <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>{opt.label}</Text>
                  {active && <Ionicons name="checkmark" size={18} color="#3b82f6" />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  safeArea: { flex: 1 },
  listArea: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four },
  error: { color: '#ef4444', textAlign: 'center' },
  emptyText: { color: '#6b7280', textAlign: 'center', marginTop: Spacing.four, paddingHorizontal: Spacing.four },
  list: { paddingHorizontal: Spacing.two, paddingTop: Spacing.two },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordmark: { fontSize: 18, fontWeight: '700', color: '#111111' },
  wordmarkAccent: { color: '#3b82f6' },
  profileButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.two,
  },
  locationText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },

  mapWrap: { marginHorizontal: 0, marginBottom: Spacing.two, borderRadius: 12, overflow: 'hidden' },

  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: Spacing.two,
    marginBottom: Spacing.two,
  },
  sortButtonText: { fontSize: 12, fontWeight: '600', color: '#3b82f6' },

  sortBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sortSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },
  sortSheetTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: Spacing.two },
  sortOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  sortOptionText: { flex: 1, fontSize: 15, color: '#111111' },
  sortOptionTextActive: { fontWeight: '700', color: '#3b82f6' },

  floatingTabBarWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  floatingTabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 9999,
    padding: 4,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  floatingTab: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 9999, alignItems: 'center' },
  floatingTabActive: { backgroundColor: '#3b82f6' },
  floatingTabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  floatingTabTextActive: { color: '#ffffff' },
});
