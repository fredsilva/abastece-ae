import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchStations, type FuelType, type Station } from '@/lib/api';

const FUEL_TABS: { key: FuelType; label: string }[] = [
  { key: 'gasolina', label: 'Gasolina' },
  { key: 'etanol', label: 'Etanol' },
  { key: 'diesel', label: 'Diesel' },
];

function formatPrice(price: number): string {
  return `R$ ${price.toFixed(2).replace('.', ',')}`;
}

function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function StationCard({ station }: { station: Station }) {
  const distance = formatDistance(station.distanceMeters);
  const address = [station.addressStreet, station.addressNumber].filter(Boolean).join(', ');

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <ThemedText style={styles.stationName} numberOfLines={1}>
            {station.nomeFantasia}
          </ThemedText>
          {station.brand && (
            <ThemedText style={styles.brand} themeColor="textSecondary">
              {station.brand}
            </ThemedText>
          )}
        </View>
        {station.ratingsCount >= 10 && station.ratingAvg !== null && (
          <ThemedText style={styles.rating}>★ {station.ratingAvg.toFixed(1)}</ThemedText>
        )}
      </View>

      <View style={styles.badgeRow}>
        {station.cheapest && (
          <View style={[styles.badge, styles.badgeCheapest]}>
            <ThemedText style={styles.badgeText}>Mais barato</ThemedText>
          </View>
        )}
        {(station.pixDiscount || station.cashDiscount) && (
          <View style={[styles.badge, styles.badgeDiscount]}>
            <ThemedText style={styles.badgeText}>Desconto no Pix ou Dinheiro</ThemedText>
          </View>
        )}
      </View>

      <View style={styles.priceRow}>
        <ThemedText style={styles.price}>{formatPrice(station.price)}</ThemedText>
        {station.previousPrice !== null && station.previousPrice !== station.price && (
          <ThemedText style={styles.previousPrice} themeColor="textSecondary">
            {formatPrice(station.previousPrice)}
          </ThemedText>
        )}
        <ThemedText style={styles.updatedAt} themeColor="textSecondary">
          {formatRelativeTime(station.priceChangedAt)}
        </ThemedText>
      </View>

      <ThemedText style={styles.meta} themeColor="textSecondary" numberOfLines={1}>
        {[distance, address || station.city].filter(Boolean).join(' · ')}
      </ThemedText>
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

  const showSetDefault = useMemo(
    () => user !== null && user.defaultFuelTab !== selectedFuel,
    [user, selectedFuel]
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Abastece Aê</ThemedText>
          <TouchableOpacity onPress={logout}>
            <ThemedText type="link" themeColor="textSecondary">
              Sair
            </ThemedText>
          </TouchableOpacity>
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
                <ThemedText style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {showSetDefault && (
          <TouchableOpacity style={styles.setDefaultLink} onPress={handleSetDefault} disabled={settingDefault}>
            <ThemedText type="link" themeColor="textSecondary">
              {settingDefault ? 'Salvando...' : 'Definir como aba padrão'}
            </ThemedText>
          </TouchableOpacity>
        )}

        {loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.centerFill}>
            <ThemedText style={styles.error}>{error}</ThemedText>
          </View>
        ) : stations.length === 0 ? (
          <View style={styles.centerFill}>
            <ThemedText themeColor="textSecondary">Nenhum posto com preço de {selectedFuel} cadastrado ainda.</ThemedText>
          </View>
        ) : (
          <FlatList
            data={stations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <StationCard station={item} />}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  title: { fontSize: 22, fontWeight: '600' },
  tabGroup: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 9999,
    padding: 4,
    marginHorizontal: Spacing.four,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  tabTextActive: { color: '#111111' },
  setDefaultLink: { alignSelf: 'center', marginTop: Spacing.two },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.four },
  error: { color: '#ef4444', textAlign: 'center' },
  list: { padding: Spacing.four, gap: Spacing.three },
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: Spacing.three,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two },
  cardHeaderText: { flex: 1 },
  stationName: { fontSize: 16, fontWeight: '600' },
  brand: { fontSize: 13, marginTop: 2 },
  rating: { fontSize: 14, fontWeight: '600', color: '#fb923c' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 9999 },
  badgeCheapest: { backgroundColor: '#34d399' },
  badgeDiscount: { backgroundColor: '#fb923c' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#ffffff' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 },
  price: { fontSize: 22, fontWeight: '700' },
  previousPrice: { fontSize: 14, textDecorationLine: 'line-through' },
  updatedAt: { fontSize: 12, marginLeft: 'auto' },
  meta: { fontSize: 13, marginTop: 6 },
});
