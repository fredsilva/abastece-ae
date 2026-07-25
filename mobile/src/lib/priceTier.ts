export type PriceTier = 'best' | 'mid' | 'worst';

// Mesmos tokens semânticos do DESIGN-cal.md (success/warning/error).
export const PRICE_TIER_COLORS: Record<PriceTier, string> = {
  best: '#10b981',
  mid: '#f59e0b',
  worst: '#ef4444',
};

// Divide os postos em 3 faixas pela posição do preço dentro do intervalo [min, max] da
// lista atual (não por contagem de postos) — assim a faixa reflete o quão perto/longe cada
// preço está do mais barato e do mais caro do momento, e não uma tercil arbitrária.
export function computePriceTiers(stations: { id: string; price: number }[]): Map<string, PriceTier> {
  const tiers = new Map<string, PriceTier>();
  if (stations.length === 0) return tiers;

  const prices = stations.map((s) => s.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;

  for (const s of stations) {
    if (range === 0) {
      tiers.set(s.id, 'best');
      continue;
    }
    const relative = (s.price - min) / range;
    tiers.set(s.id, relative <= 1 / 3 ? 'best' : relative <= 2 / 3 ? 'mid' : 'worst');
  }

  return tiers;
}
