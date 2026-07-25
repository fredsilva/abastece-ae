import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  onStationPress?: (station: Station) => void;
}

export function StationMapPreview({ stations, tiers, userCoords, onStationPress }: Props) {
  // Estável entre re-renders enquanto a localização não mudar de verdade — senão a câmera
  // volta a centralizar no usuário toda vez que a lista de postos muda (ex: troca de aba),
  // brigando com o pan manual do usuário no mapa.
  const center = useMemo<[number, number] | null>(() => {
    if (userCoords) return [userCoords.longitude, userCoords.latitude];
    if (stations[0]) return [stations[0].longitude, stations[0].latitude];
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCoords?.latitude, userCoords?.longitude, stations[0]?.longitude, stations[0]?.latitude]);

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
              <TouchableOpacity
                style={[styles.pin, { backgroundColor: tierColor }, station.cheapest && styles.pinCheapest]}
                onPress={() => onStationPress?.(station)}
              >
                <Text style={styles.pinText}>{formatPrice(station.price)}</Text>
              </TouchableOpacity>
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
