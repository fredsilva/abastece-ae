import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, LineLayer, MapView, PointAnnotation, ShapeSource } from '@rnmapbox/maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { fetchDrivingRoute, type DrivingRoute } from '@/lib/mapbox-directions';
import type { FuelType, Station } from '@/lib/api';
import { formatDistance, formatDuration, formatPrice, formatRelativeTime } from '@/lib/format';

export default function StationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ station: string; fuel: FuelType; userLat?: string; userLng?: string }>();
  const station: Station = useMemo(() => JSON.parse(params.station), [params.station]);
  const userCoords = useMemo(() => {
    if (!params.userLat || !params.userLng) return null;
    return { latitude: Number(params.userLat), longitude: Number(params.userLng) };
  }, [params.userLat, params.userLng]);

  const [route, setRoute] = useState<DrivingRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    if (!userCoords) return;
    setRouteLoading(true);
    fetchDrivingRoute(userCoords, { latitude: station.latitude, longitude: station.longitude })
      .then(setRoute)
      .finally(() => setRouteLoading(false));
  }, [userCoords, station.latitude, station.longitude]);

  const bounds = userCoords
    ? {
        ne: [
          Math.max(userCoords.longitude, station.longitude),
          Math.max(userCoords.latitude, station.latitude),
        ] as [number, number],
        sw: [
          Math.min(userCoords.longitude, station.longitude),
          Math.min(userCoords.latitude, station.latitude),
        ] as [number, number],
        paddingTop: 100,
        paddingBottom: 280,
        paddingLeft: 60,
        paddingRight: 60,
      }
    : undefined;

  function handleNavigate() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`;
    Linking.openURL(url);
  }

  function handleReportPrice() {
    router.push({
      pathname: '/report-price',
      params: {
        stationId: station.id,
        stationName: station.nomeFantasia,
        fuel: params.fuel,
        currentPrice: String(station.price),
      },
    });
  }

  const pinColor = station.cheapest ? '#10b981' : '#3b82f6';
  const distance = formatDistance(station.distanceMeters);

  return (
    <View style={styles.container}>
      <MapView style={styles.map} logoEnabled={false} attributionEnabled={false}>
        {bounds ? (
          <Camera bounds={bounds} animationDuration={0} />
        ) : (
          <Camera centerCoordinate={[station.longitude, station.latitude]} zoomLevel={14} animationDuration={0} />
        )}

        {userCoords && (
          <PointAnnotation id="user-location" coordinate={[userCoords.longitude, userCoords.latitude]}>
            <View style={styles.userDot} />
          </PointAnnotation>
        )}

        <PointAnnotation id="station" coordinate={[station.longitude, station.latitude]} anchor={{ x: 0.5, y: 1 }}>
          <Ionicons name="location" size={40} color={pinColor} />
        </PointAnnotation>

        {route && (
          <ShapeSource id="route-source" shape={{ type: 'Feature', properties: {}, geometry: route.geometry }}>
            <LineLayer
              id="route-line"
              style={{ lineColor: '#3b82f6', lineWidth: 4, lineCap: 'round', lineJoin: 'round' }}
            />
          </ShapeSource>
        )}
      </MapView>

      <SafeAreaView style={styles.topOverlay} edges={['top', 'left']}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#111111" />
        </TouchableOpacity>
      </SafeAreaView>

      <SafeAreaView style={styles.sheet} edges={['bottom', 'left', 'right']}>
        <View style={styles.sheetHandle} />

        <View style={styles.sheetHeader}>
          <View style={[styles.iconCircle, { backgroundColor: pinColor }]}>
            <MaterialCommunityIcons name="gas-station" size={20} color="#ffffff" />
          </View>
          <View style={styles.sheetHeaderText}>
            <Text style={styles.stationName} numberOfLines={2}>
              {station.nomeFantasia}
            </Text>
            {station.brand && <Text style={styles.brand}>{station.brand}</Text>}
          </View>
          <View style={styles.priceCol}>
            <Text style={styles.price}>{formatPrice(station.price)}</Text>
            {station.previousPrice !== null && station.previousPrice !== station.price && (
              <Text style={styles.previousPrice}>{formatPrice(station.previousPrice)}</Text>
            )}
          </View>
        </View>

        <View style={styles.badgeRow}>
          {station.cheapest && (
            <View style={[styles.badge, styles.badgeCheapest]}>
              <Text style={styles.badgeText}>Mais barato</Text>
            </View>
          )}
          {(station.pixDiscount || station.cashDiscount) && (
            <View style={[styles.badge, styles.badgeDiscount]}>
              <Text style={styles.badgeText}>Desconto no Pix ou Dinheiro</Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          {distance && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color="#6b7280" />
              <Text style={styles.metaText}>{distance}</Text>
            </View>
          )}
          {routeLoading ? (
            <View style={styles.metaItem}>
              <ActivityIndicator size="small" />
            </View>
          ) : (
            route && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color="#6b7280" />
                <Text style={styles.metaText}>{formatDuration(route.durationSeconds)} de carro</Text>
              </View>
            )
          )}
          <View style={styles.metaItem}>
            <Ionicons name="refresh-outline" size={14} color="#6b7280" />
            <Text style={styles.metaText}>Atualizado {formatRelativeTime(station.priceChangedAt)}</Text>
          </View>
        </View>

        {[station.addressStreet, station.addressNumber].filter(Boolean).length > 0 && (
          <Text style={styles.address} numberOfLines={1}>
            {[station.addressStreet, station.addressNumber].filter(Boolean).join(', ')}
          </Text>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.reportButton} onPress={handleReportPrice}>
            <Ionicons name="pricetag-outline" size={18} color="#3b82f6" />
            <Text style={styles.reportButtonText}>Reportar preço</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
            <Ionicons name="navigate" size={18} color="#ffffff" />
            <Text style={styles.navigateButtonText}>Navegar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  map: { flex: 1 },

  topOverlay: { position: 'absolute', top: 0, left: 0 },
  backButton: {
    marginTop: 8,
    marginLeft: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  userDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sheetHeaderText: { flex: 1, minWidth: 0 },
  stationName: { fontSize: 17, fontWeight: '700', color: '#111111' },
  brand: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: 20, fontWeight: '700', color: '#111111' },
  previousPrice: { fontSize: 13, color: '#9ca3af', textDecorationLine: 'line-through', marginTop: 2 },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 9999 },
  badgeCheapest: { backgroundColor: '#10b981' },
  badgeDiscount: { backgroundColor: '#fb923c' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: '#6b7280' },
  address: { fontSize: 13, color: '#6b7280', marginTop: 8 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 12 },
  reportButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 14,
  },
  reportButtonText: { color: '#3b82f6', fontSize: 15, fontWeight: '700' },
  navigateButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 14,
  },
  navigateButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
