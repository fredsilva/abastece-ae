export interface RankingWeights {
  price: number;
  distance: number;
  rating: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = { price: 0.5, distance: 0.3, rating: 0.2 };

// Bayesian rating credibility threshold ("m" no plano) — abaixo disso a nota não aparece na UI.
export const MIN_RATINGS_FOR_SCORE = 10;

// Abaixo desse confidence_score o posto não concorre ao badge "Mais barato".
const CHEAPEST_MIN_CONFIDENCE = 0.3;

export interface RankableStation {
  id: string;
  price: number;
  confidenceScore: number;
  distanceMeters: number | null;
  ratingsCount: number;
  bayesianScore: number | null;
}

export interface RankedStation extends RankableStation {
  priceScore: number;
  distanceScore: number;
  ratingScore: number;
  overallScore: number;
  cheapest: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function rankStations(
  stations: RankableStation[],
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS
): RankedStation[] {
  if (stations.length === 0) return [];

  const prices = stations.map((s) => s.price);
  const minPrice = Math.min(...prices);
  const priceRange = Math.max(...prices) - minPrice || 1;

  const hasDistances = stations.every((s) => s.distanceMeters != null);
  const distances = hasDistances ? stations.map((s) => s.distanceMeters as number) : [];
  const minDist = hasDistances ? Math.min(...distances) : 0;
  const distRange = hasDistances ? Math.max(...distances) - minDist || 1 : 1;

  const cheapestCandidates = stations.filter((s) => s.confidenceScore >= CHEAPEST_MIN_CONFIDENCE);
  const cheapestPrice = cheapestCandidates.length > 0 ? Math.min(...cheapestCandidates.map((s) => s.price)) : null;

  const scored = stations.map((s) => {
    const priceScore = (1 - (s.price - minPrice) / priceRange) * clamp(s.confidenceScore, 0.05, 1);
    const distanceScore = hasDistances ? 1 - ((s.distanceMeters as number) - minDist) / distRange : 1;
    const ratingScore =
      s.ratingsCount >= MIN_RATINGS_FOR_SCORE && s.bayesianScore != null ? s.bayesianScore / 5 : 0.5;
    const overallScore = weights.price * priceScore + weights.distance * distanceScore + weights.rating * ratingScore;

    return {
      ...s,
      priceScore,
      distanceScore,
      ratingScore,
      overallScore,
      cheapest: cheapestPrice !== null && s.price === cheapestPrice,
    };
  });

  return scored.sort((a, b) => b.overallScore - a.overallScore || a.price - b.price || a.id.localeCompare(b.id));
}
