import { StyleSheet, Text, View } from 'react-native';
import Mapbox, { Camera, MapView, PointAnnotation } from '@rnmapbox/maps';

import { formatPrice } from '@/lib/format';
import type { Station } from '@/lib/api';
import { PRICE_TIER_COLORS, type PriceTier } from '@/lib/priceTier';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
if (MAPBOX_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
}

interface Props {
  stations: Station[];
  tiers: Map<string, PriceTier>;
  userCoords: { latitude: number; longitude: number } | null;
}

export function StationMapPreview({ stations, tiers, userCoords }: Props) {
  const center = userCoords
    ? ([userCoords.longitude, userCoords.latitude] as [number, number])
    : stations[0]
      ? ([stations[0].longitude, stations[0].latitude] as [number, number])
      : null;

  if (!center) return null;

  return (
    <View style={styles.card}>
      <MapView style={styles.map} scaleBarEnabled={false} logoEnabled={false} attributionEnabled={false}>
        <Camera centerCoordinate={center} zoomLevel={13} animationDuration={0} />

        {userCoords && (
          <PointAnnotation id="user-location" coordinate={[userCoords.longitude, userCoords.latitude]}>
            <View style={styles.userDot} />
          </PointAnnotation>
        )}

        {stations.map((station) => {
          const tier = tiers.get(station.id) ?? 'mid';
          const tierColor = PRICE_TIER_COLORS[tier];
          return (
            <PointAnnotation key={station.id} id={`station-${station.id}`} coordinate={[station.longitude, station.latitude]}>
              <View style={[styles.pin, { backgroundColor: tierColor }, station.cheapest && styles.pinCheapest]}>
                <Text style={styles.pinText}>{formatPrice(station.price)}</Text>
              </View>
            </PointAnnotation>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  map: { flex: 1 },
  userDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pin: {
    borderRadius: 9999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  pinCheapest: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pinText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
});
