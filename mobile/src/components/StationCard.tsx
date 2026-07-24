import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { Spacing } from '@/constants/theme';
import type { Station } from '@/lib/api';
import { formatDistance, formatPrice, formatPriceDelta, formatRelativeTime } from '@/lib/format';

const ICON_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#fb923c'];

function stationIconColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ICON_COLORS[hash % ICON_COLORS.length];
}

export function StationCard({
  station,
  cheapestPrice,
  onPress,
}: {
  station: Station;
  cheapestPrice: number;
  onPress: () => void;
}) {
  const distance = formatDistance(station.distanceMeters);
  const iconColor = useMemo(() => stationIconColor(station.id), [station.id]);
  const hasRating = station.ratingsCount >= 10 && station.ratingAvg !== null;

  return (
    <TouchableOpacity style={[styles.card, station.cheapest && styles.cardCheapest]} onPress={onPress}>
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
