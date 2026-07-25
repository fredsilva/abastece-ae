import { useMemo } from 'react';
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
            <View style={styles.userLocationWrap}>
              <View style={styles.userLocationHalo} />
              <View style={styles.userLocationDot} />
            </View>
          </PointAnnotation>
        )}

        {stations.map((station) => {
          const tier = tiers.get(station.id) ?? 'mid';
          const tierColor = PRICE_TIER_COLORS[tier];
          return (
            // O id inclui o preço de propósito: o PointAnnotation do @rnmapbox/maps não
            // atualiza o conteúdo nativo sozinho quando só os children React mudam — trocar o
            // id força remontar a annotation com o preço/cor certos ao trocar de combustível.
            <PointAnnotation
              key={`${station.id}-${station.price}`}
              id={`station-${station.id}-${station.price}`}
              coordinate={[station.longitude, station.latitude]}
              onSelected={() => onStationPress?.(station)}
            >
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
    backgroundColor: '#f5f5f5',
  },
  map: { flex: 1 },
  userLocationWrap: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  userLocationHalo: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.25)',
  },
  userLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    borderWidth: 3,
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
