import { MIN_RATINGS_FOR_SCORE } from "./ranking";

// Recalcula gas_station_rating_summary após uma nova avaliação. bayesian_score usa o mesmo
// "m" de credibilidade do ranking (MIN_RATINGS_FOR_SCORE): posto com poucas avaliações fica
// puxado para a média da cidade (prior), evitando que 1-2 notas extremas dominem o ranking.
export async function recomputeRatingSummary(db: D1Database, gasStationId: string): Promise<void> {
  const station = await db
    .prepare("SELECT city_id FROM gas_stations WHERE id = ?")
    .bind(gasStationId)
    .first<{ city_id: string }>();
  if (!station) return;

  const stationAgg = await db
    .prepare("SELECT COUNT(*) as count, AVG(avg_stars) as avg FROM ratings WHERE gas_station_id = ?")
    .bind(gasStationId)
    .first<{ count: number; avg: number | null }>();

  const ratingsCount = stationAgg?.count ?? 0;
  const stationAvg = stationAgg?.avg ?? null;

  const cityAgg = await db
    .prepare(
      `SELECT AVG(r.avg_stars) as avg FROM ratings r
       JOIN gas_stations gs ON gs.id = r.gas_station_id
       WHERE gs.city_id = ?`
    )
    .bind(station.city_id)
    .first<{ avg: number | null }>();
  const cityAvg = cityAgg?.avg ?? stationAvg ?? 0;

  const bayesianScore =
    ratingsCount > 0
      ? (ratingsCount / (ratingsCount + MIN_RATINGS_FOR_SCORE)) * (stationAvg as number) +
        (MIN_RATINGS_FOR_SCORE / (ratingsCount + MIN_RATINGS_FOR_SCORE)) * cityAvg
      : null;

  await db
    .prepare(
      `INSERT INTO gas_station_rating_summary (gas_station_id, ratings_count, avg_overall, bayesian_score, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(gas_station_id) DO UPDATE SET
         ratings_count = excluded.ratings_count,
         avg_overall = excluded.avg_overall,
         bayesian_score = excluded.bayesian_score,
         updated_at = excluded.updated_at`
    )
    .bind(gasStationId, ratingsCount, stationAvg, bayesianScore, new Date().toISOString())
    .run();
}
