import { Hono } from "hono";
import { requireUser } from "../middleware/requireUser";
import { haversineMeters } from "../lib/geo";
import { rankStations, type RankableStation } from "../lib/ranking";

type FuelType = "gasolina" | "etanol" | "diesel";
const FUEL_TYPES: FuelType[] = ["gasolina", "etanol", "diesel"];

interface FavoriteStationRow {
  id: string;
  nome_fantasia: string;
  brand: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  price: number;
  previous_price: number | null;
  price_changed_at: string;
  last_reported_at: string;
  pix_discount: number;
  cash_discount: number;
  confidence_score: number;
  ratings_count: number | null;
  bayesian_score: number | null;
}

export const favorites = new Hono<{ Bindings: Env; Variables: { userId: string; userEmail: string } }>();

// Set leve de IDs favoritados — usado pra pintar o ícone de estrela na Home/tela do posto
// sem precisar buscar os dados completos de cada posto.
favorites.get("/ids", requireUser, async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare("SELECT gas_station_id FROM favorites WHERE user_id = ?")
    .bind(userId)
    .all<{ gas_station_id: string }>();
  return c.json({ stationIds: results.map((r) => r.gas_station_id) });
});

favorites.get("/", requireUser, async (c) => {
  const fuelParam = c.req.query("fuel") ?? "gasolina";
  if (!FUEL_TYPES.includes(fuelParam as FuelType)) {
    return c.json({ error: "fuel deve ser gasolina, etanol ou diesel" }, 400);
  }
  const fuel = fuelParam as FuelType;
  const userId = c.get("userId");

  const latParam = c.req.query("lat");
  const lngParam = c.req.query("lng");
  const lat = latParam !== undefined ? Number(latParam) : null;
  const lng = lngParam !== undefined ? Number(lngParam) : null;
  const hasLocation = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);

  const { results } = await c.env.DB.prepare(
    `SELECT gs.id, gs.nome_fantasia, gs.brand, gs.address_street, gs.address_number, gs.address_neighborhood,
            gs.city, gs.state, gs.latitude, gs.longitude,
            fp.price, fp.previous_price, fp.price_changed_at, fp.last_reported_at,
            fp.pix_discount, fp.cash_discount, fp.confidence_score,
            rs.ratings_count, rs.bayesian_score
     FROM favorites f
     JOIN gas_stations gs ON gs.id = f.gas_station_id
     JOIN fuel_prices fp ON fp.gas_station_id = gs.id AND fp.fuel_type = ?
     LEFT JOIN gas_station_rating_summary rs ON rs.gas_station_id = gs.id
     WHERE f.user_id = ? AND gs.status = 'active'
     ORDER BY f.created_at DESC`
  )
    .bind(fuel, userId)
    .all<FavoriteStationRow>();

  const rankable: RankableStation[] = results.map((row) => ({
    id: row.id,
    price: row.price,
    confidenceScore: row.confidence_score,
    distanceMeters: hasLocation ? haversineMeters(lat as number, lng as number, row.latitude, row.longitude) : null,
    ratingsCount: row.ratings_count ?? 0,
    bayesianScore: row.bayesian_score,
  }));

  // rankStations só serve aqui pra calcular o badge "Mais barato" dentro do próprio conjunto
  // de favoritos e normalizar distância — a ordem de exibição continua sendo a de favoritado
  // mais recente primeiro (results já vem assim, e o map abaixo preserva a ordem de `results`).
  const ranked = rankStations(rankable);
  const rankedById = new Map(ranked.map((r) => [r.id, r]));

  const stationsOut = results.map((row) => {
    const r = rankedById.get(row.id)!;
    return {
      id: row.id,
      nomeFantasia: row.nome_fantasia,
      brand: row.brand,
      addressStreet: row.address_street,
      addressNumber: row.address_number,
      addressNeighborhood: row.address_neighborhood,
      city: row.city,
      state: row.state,
      latitude: row.latitude,
      longitude: row.longitude,
      distanceMeters: r.distanceMeters,
      price: row.price,
      previousPrice: row.previous_price,
      priceChangedAt: row.price_changed_at,
      lastReportedAt: row.last_reported_at,
      pixDiscount: row.pix_discount === 1,
      cashDiscount: row.cash_discount === 1,
      confidenceScore: row.confidence_score,
      ratingAvg: row.ratings_count && row.ratings_count >= 10 ? row.bayesian_score : null,
      ratingsCount: row.ratings_count ?? 0,
      cheapest: r.cheapest,
    };
  });

  return c.json({ fuel, stations: stationsOut });
});

favorites.post("/:stationId", requireUser, async (c) => {
  const stationId = c.req.param("stationId");
  const userId = c.get("userId");

  const station = await c.env.DB.prepare("SELECT id FROM gas_stations WHERE id = ? AND status = 'active'")
    .bind(stationId)
    .first();
  if (!station) {
    return c.json({ error: "posto não encontrado" }, 404);
  }

  await c.env.DB.prepare("INSERT OR IGNORE INTO favorites (user_id, gas_station_id, created_at) VALUES (?, ?, ?)")
    .bind(userId, stationId, new Date().toISOString())
    .run();

  return c.json({ ok: true });
});

favorites.delete("/:stationId", requireUser, async (c) => {
  const stationId = c.req.param("stationId");
  const userId = c.get("userId");

  await c.env.DB.prepare("DELETE FROM favorites WHERE user_id = ? AND gas_station_id = ?").bind(userId, stationId).run();

  return c.json({ ok: true });
});
