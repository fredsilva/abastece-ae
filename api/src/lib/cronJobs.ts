import { recomputeRatingSummary } from "./ratingSummary";

// Quantos dias, sem nenhum report novo, até confidence_score cair de 1.0 a 0 (decaimento linear).
// Ver PLANO-MVP.md, item "Decaimento de confiança (Cron diário)".
const CONFIDENCE_DECAY_WINDOW_DAYS = 21;
const CONFIDENCE_DECAY_STEP = 1 / CONFIDENCE_DECAY_WINDOW_DAYS;

// Decai confidence_score em fuel_prices cujo último report tem mais de 1 dia. Usa um passo
// fixo por execução (não recalcula a partir da idade) para nunca *aumentar* a confiança de
// preços semeados com confidence_score baixo de propósito (ex.: média ANP com score 0).
export async function decayConfidenceScores(db: D1Database): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await db
    .prepare(
      `UPDATE fuel_prices SET confidence_score = MAX(0, confidence_score - ?)
       WHERE last_reported_at < ? AND confidence_score > 0`
    )
    .bind(CONFIDENCE_DECAY_STEP, cutoff)
    .run();
}

// Recalcula gas_station_rating_summary de todo posto avaliado — necessário porque o
// bayesian_score de cada posto depende da média da cidade, que muda mesmo sem uma nova
// avaliação naquele posto específico (ver recomputeRatingSummary em ratingSummary.ts).
export async function recomputeAllRatingSummaries(db: D1Database): Promise<void> {
  const stations = await db.prepare("SELECT DISTINCT gas_station_id FROM ratings").all<{
    gas_station_id: string;
  }>();

  for (const row of stations.results ?? []) {
    await recomputeRatingSummary(db, row.gas_station_id);
  }
}

// Remove sessões que já expiraram ou foram revogadas há mais de 1 dia (mantém uma janela
// curta de auditoria para revogações recentes em vez de apagar imediatamente).
export async function cleanupExpiredSessions(db: D1Database): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await db
    .prepare(
      `DELETE FROM auth_sessions
       WHERE (expires_at IS NOT NULL AND expires_at < ?)
          OR (revoked_at IS NOT NULL AND revoked_at < ?)`
    )
    .bind(cutoff, cutoff)
    .run();
}
