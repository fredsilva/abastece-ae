import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { StationMapPreview } from '@/components/StationMapPreview';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchStations, type FuelType, type Station } from '@/lib/api';
import { formatDistance, formatPrice, formatPriceDelta, formatRelativeTime } from '@/lib/format';

const FUEL_TABS: { key: FuelType; label: string }[] = [
  { key: 'gasolina', label: 'Gasolina' },
  { key: 'etanol', label: 'Etanol' },
  { key: 'diesel', label: 'Diesel' },
];

const ICON_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#fb923c'];

function stationIconColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ICON_COLORS[hash % ICON_COLORS.length];
}

function StationCard({ station, cheapestPrice }: { station: Station; cheapestPrice: number }) {
  const distance = formatDistance(station.distanceMeters);
  const iconColor = useMemo(() => stationIconColor(station.id), [station.id]);
  const hasRating = station.ratingsCount >= 10 && station.ratingAvg !== null;

  return (
    <View style={[styles.card, station.cheapest && styles.cardCheapest]}>
      <View style={[styles.iconCircle, { backgroundColor: iconColor }]}>
        <MaterialCommunityIcons name="gas-station" size={18} color="#ffffff" />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <Text style={styles.stationName} numberOfLines={1}>
            {station.nomeFantasia}
          </Text>
          {station.cheapest && (
            <View style={styles.cheapestBadge}>
              <Text style={styles.cheapestBadgeText}>Mais barato</Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          {distance && <Text style={styles.metaText}>{distance}</Text>}
          {hasRating && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Ionicons name="star" size={12} color="#fb923c" />
              <Text style={styles.metaText}>{station.ratingAvg!.toFixed(1)}</Text>
            </>
          )}
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{formatRelativeTime(station.priceChangedAt)}</Text>
        </View>
      </View>

      <View style={styles.priceCol}>
        <Text style={styles.price}>{formatPrice(station.price)}</Text>
        {!station.cheapest && (
          <Text style={styles.priceDelta}>{formatPriceDelta(station.price, cheapestPrice)}</Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
    </View>
  );
}

export default function HomeScreen() {
  const { user, logout, setDefaultFuelTab } = useAuth();
  const [selectedFuel, setSelectedFuel] = useState<FuelType>(user?.defaultFuelTab ?? 'gasolina');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState(false);

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
    Alert.alert(user?.email ?? 'Conta', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  }

  const showSetDefault = useMemo(() => user !== null && user.defaultFuelTab !== selectedFuel, [user, selectedFuel]);
  const cheapestPrice = useMemo(
    () => (stations.length > 0 ? Math.min(...stations.map((s) => s.price)) : 0),
    [stations]
  );
  const cityLabel = stations[0] ? `${stations[0].city} - ${stations[0].state}` : null;

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
        <TouchableOpacity style={styles.profileButton} onPress={handleProfilePress}>
          <Ionicons name="person-outline" size={18} color="#111111" />
        </TouchableOpacity>
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
            data={stations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <StationCard station={item} cheapestPrice={cheapestPrice} />}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Nenhum posto com preço de {selectedFuel} cadastrado ainda.</Text>
            }
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          />
        )}
      </SafeAreaView>
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

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginTop: Spacing.two,
  },
  cardCheapest: { borderColor: '#10b981', borderWidth: 1.5 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stationName: { fontSize: 15, fontWeight: '600', color: '#111111', flexShrink: 1 },
  cheapestBadge: { backgroundColor: '#10b981', borderRadius: 9999, paddingVertical: 2, paddingHorizontal: 8 },
  cheapestBadgeText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  metaText: { fontSize: 12, color: '#6b7280' },
  metaDot: { fontSize: 12, color: '#6b7280' },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: 16, fontWeight: '700', color: '#111111' },
  priceDelta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
});
