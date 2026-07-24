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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { StationCard } from '@/components/StationCard';
import { StationMapPreview } from '@/components/StationMapPreview';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchStations, type FuelType, type Station } from '@/lib/api';

const FUEL_TABS: { key: FuelType; label: string }[] = [
  { key: 'gasolina', label: 'Gasolina' },
  { key: 'etanol', label: 'Etanol' },
  { key: 'diesel', label: 'Diesel' },
];

type SortMode = 'best' | 'price' | 'distance';

const SORT_OPTIONS: { key: SortMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'best', label: 'Melhor custo-benefício', icon: 'sparkles-outline' },
  { key: 'price', label: 'Preço', icon: 'pricetag-outline' },
  { key: 'distance', label: 'Proximidade', icon: 'location-outline' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, setDefaultFuelTab } = useAuth();
  const [selectedFuel, setSelectedFuel] = useState<FuelType>(user?.defaultFuelTab ?? 'gasolina');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('best');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
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

  async function handleSetDefault() {
    setSettingDefault(true);
    try {
      await setDefaultFuelTab(selectedFuel);
    } catch {
      // silencioso — não é uma ação crítica, o usuário pode tentar de novo
    } finally {
      setSettingDefault(false);
    }
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

  const showSetDefault = useMemo(() => user !== null && user.defaultFuelTab !== selectedFuel, [user, selectedFuel]);
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
  const sortLabel = SORT_OPTIONS.find((opt) => opt.key === sortMode)!.label;

  const listHeader = (
    <View>
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

      {stations.length > 0 && <StationMapPreview stations={stations} userCoords={coords} />}

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

      {showSetDefault && (
        <TouchableOpacity style={styles.setDefaultLink} onPress={handleSetDefault} disabled={settingDefault}>
          <Text style={styles.setDefaultText}>{settingDefault ? 'Salvando...' : 'Definir como aba padrão'}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.sortButton} onPress={() => setSortMenuOpen(true)}>
        <Ionicons name="swap-vertical-outline" size={14} color="#3b82f6" />
        <Text style={styles.sortButtonText}>Ordenar: {sortLabel}</Text>
        <Ionicons name="chevron-down" size={14} color="#3b82f6" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {loading ? (
          <View style={styles.centerFill}>
            {listHeader}
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.centerFill}>
            {listHeader}
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={sortedStations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <StationCard station={item} cheapestPrice={cheapestPrice} onPress={() => handleStationPress(item)} />
            )}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Nenhum posto com preço de {selectedFuel} cadastrado ainda.</Text>
            }
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          />
        )}
      </SafeAreaView>

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
  centerFill: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.four },
  error: { color: '#ef4444', textAlign: 'center', marginTop: Spacing.four },
  emptyText: { color: '#6b7280', textAlign: 'center', marginTop: Spacing.four, paddingHorizontal: Spacing.four },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.two },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
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

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.three },
  locationText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },

  tabGroup: {
    flexDirection: 'row',
    backgroundColor: '#eef0f2',
    borderRadius: 9999,
    padding: 4,
    gap: 4,
    marginTop: Spacing.three,
  },
  tab: { flex: 1, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9999, alignItems: 'center' },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#ffffff' },

  setDefaultLink: { alignSelf: 'center', marginTop: Spacing.two },
  setDefaultText: { fontSize: 13, color: '#3b82f6', fontWeight: '600' },

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
    marginTop: Spacing.three,
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
});
