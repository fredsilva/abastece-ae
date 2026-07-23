import { StyleSheet, Text, View } from 'react-native';
import Mapbox, { Camera, MapView, PointAnnotation } from '@rnmapbox/maps';

import { formatPrice } from '@/lib/format';
import type { Station } from '@/lib/api';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
if (MAPBOX_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
}

const MAX_PINS = 5;

interface Props {
  stations: Station[];
  userCoords: { latitude: number; longitude: number } | null;
}

export function StationMapPreview({ stations, userCoords }: Props) {
  const pinned = stations.slice(0, MAX_PINS);
  const center = userCoords
    ? ([userCoords.longitude, userCoords.latitude] as [number, number])
    : pinned[0]
      ? ([pinned[0].longitude, pinned[0].latitude] as [number, number])
      : null;

  if (!center) return null;

  return (
    <View style={styles.card}>
      <MapView
        style={styles.map}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Camera centerCoordinate={center} zoomLevel={13} animationDuration={0} />

        {userCoords && (
          <PointAnnotation id="user-location" coordinate={[userCoords.longitude, userCoords.latitude]}>
            <View style={styles.userDot} />
          </PointAnnotation>
        )}

        {pinned.map((station) => (
          <PointAnnotation key={station.id} id={`station-${station.id}`} coordinate={[station.longitude, station.latitude]}>
            <View style={[styles.pin, station.cheapest && styles.pinCheapest]}>
              <Text style={[styles.pinText, station.cheapest && styles.pinTextCheapest]}>{formatPrice(station.price)}</Text>
            </View>
          </PointAnnotation>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 180,
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
    backgroundColor: '#ffffff',
    borderRadius: 9999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pinCheapest: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  pinText: { fontSize: 12, fontWeight: '700', color: '#111111' },
  pinTextCheapest: { color: '#ffffff' },
});
