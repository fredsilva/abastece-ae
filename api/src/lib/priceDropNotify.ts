import { sendExpoPushNotifications } from "./push";

type FuelType = "gasolina" | "etanol" | "diesel";

const FUEL_LABELS: Record<FuelType, string> = {
  gasolina: "gasolina",
  etanol: "etanol",
  diesel: "diesel",
};

// Evita notificar de novo o mesmo posto+combustível numa janela curta (preço oscilando) —
// ver PLANO-MVP.md, seção "Favoritos e notificação de queda de preço".
const DEDUPE_WINDOW_HOURS = 6;

// Dispara push pros usuários que favoritaram o posto quando um preço aceito (report do app
// ou edição do admin) resulta numa queda real em relação ao preço anterior. Chamado a partir
// de applyPriceReport.ts e do PUT /admin/stations/:id/prices — os dois pontos que efetivamente
// gravam um novo preço em fuel_prices.
export async function notifyPriceDrop(
  db: D1Database,
  gasStationId: string,
  fuelType: FuelType,
  newPrice: number,
  previousPrice: number | null
): Promise<void> {
  if (previousPrice === null || newPrice >= previousPrice) return;

  const priceRow = await db
    .prepare("SELECT last_drop_notified_at FROM fuel_prices WHERE gas_station_id = ? AND fuel_type = ?")
    .bind(gasStationId, fuelType)
    .first<{ last_drop_notified_at: string | null }>();

  if (priceRow?.last_drop_notified_at) {
    const elapsedMs = Date.now() - new Date(priceRow.last_drop_notified_at).getTime();
    if (elapsedMs < DEDUPE_WINDOW_HOURS * 60 * 60 * 1000) return;
  }

  const favoriteTokens = await db
    .prepare(
      `SELECT pt.expo_push_token FROM favorites f
       JOIN push_tokens pt ON pt.user_id = f.user_id
       WHERE f.gas_station_id = ?`
    )
    .bind(gasStationId)
    .all<{ expo_push_token: string }>();

  if (favoriteTokens.results.length === 0) return;

  const station = await db
    .prepare("SELECT nome_fantasia FROM gas_stations WHERE id = ?")
    .bind(gasStationId)
    .first<{ nome_fantasia: string }>();

  const priceText = `R$ ${newPrice.toFixed(2).replace(".", ",")}`;
  const stationName = station?.nome_fantasia ?? "Um posto favorito";

  await sendExpoPushNotifications(
    favoriteTokens.results.map((row) => ({
      to: row.expo_push_token,
      title: "Preço caiu 📉",
      body: `${stationName} baixou o preço do ${FUEL_LABELS[fuelType]} para ${priceText}`,
      data: { gasStationId, fuelType },
    }))
  );

  await db
    .prepare("UPDATE fuel_prices SET last_drop_notified_at = ? WHERE gas_station_id = ? AND fuel_type = ?")
    .bind(new Date().toISOString(), gasStationId, fuelType)
    .run();
}
