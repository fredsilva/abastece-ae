import { Hono } from "hono";
import { requireUser } from "../middleware/requireUser";
import { haversineMeters } from "../lib/geo";
import { isPriceOutlier } from "../lib/stats";
import { applyAcceptedPriceReport } from "../lib/applyPriceReport";

type FuelType = "gasolina" | "etanol" | "diesel";
const FUEL_TYPES: FuelType[] = ["gasolina", "etanol", "diesel"];

const PRICE_MIN = 1;
const PRICE_MAX = 15;
const COOLDOWN_MINUTES = 15;
const DAILY_LIMIT = 20;

export const priceReports = new Hono<{ Bindings: Env; Variables: { userId: string; userEmail: string } }>();

priceReports.post("/", requireUser, async (c) => {
  const body = await c.req.json<{
    gasStationId?: string;
    fuelType?: string;
    price?: number;
    pixDiscount?: boolean;
    cashDiscount?: boolean;
    deviceId?: string;
    gpsLat?: number;
    gpsLng?: number;
  }>();

  const { gasStationId, fuelType, price, deviceId } = body;
  if (
    !gasStationId ||
    !fuelType ||
    !FUEL_TYPES.includes(fuelType as FuelType) ||
    typeof price !== "number" ||
    !deviceId
  ) {
    return c.json({ error: "campos obrigatórios: gasStationId, fuelType, price, deviceId" }, 400);
  }
  if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) {
    return c.json({ error: `preço deve estar entre R$${PRICE_MIN.toFixed(2)} e R$${PRICE_MAX.toFixed(2)}` }, 400);
  }

  const userId = c.get("userId");
  const db = c.env.DB;

  const station = await db
    .prepare("SELECT id, city_id, latitude, longitude FROM gas_stations WHERE id = ? AND status = 'active'")
    .bind(gasStationId)
    .first<{ id: string; city_id: string; latitude: number; longitude: number }>();
  if (!station) {
    return c.json({ error: "posto não encontrado" }, 404);
  }

  const cooldownSince = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000).toISOString();
  const recent = await db
    .prepare(
      "SELECT id FROM price_reports WHERE reported_by_user_id = ? AND gas_station_id = ? AND fuel_type = ? AND created_at > ?"
    )
    .bind(userId, gasStationId, fuelType, cooldownSince)
    .first();
  if (recent) {
    return c.json({ error: "aguarde alguns minutos antes de reportar esse posto de novo" }, 429);
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [userCountToday, deviceCountToday] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) as count FROM price_reports WHERE reported_by_user_id = ? AND created_at > ?")
      .bind(userId, dayAgo)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) as count FROM price_reports WHERE device_id = ? AND created_at > ?")
      .bind(deviceId, dayAgo)
      .first<{ count: number }>(),
  ]);
  if ((userCountToday?.count ?? 0) >= DAILY_LIMIT || (deviceCountToday?.count ?? 0) >= DAILY_LIMIT) {
    return c.json({ error: "limite diário de reports atingido" }, 429);
  }

  // Só entram na base de comparação preços já confirmados (confidence_score > 0) — os
  // "aguardando confirmação" do seed da ANP são todos a mesma estimativa média da cidade,
  // o que colapsaria o IQR e faria qualquer preço real parecer outlier.
  const cityPrices = await db
    .prepare(
      `SELECT fp.price FROM fuel_prices fp
       JOIN gas_stations gs ON gs.id = fp.gas_station_id
       WHERE gs.city_id = ? AND fp.fuel_type = ? AND gs.status = 'active' AND fp.confidence_score > 0`
    )
    .bind(station.city_id, fuelType)
    .all<{ price: number }>();
  const outlier = isPriceOutlier(price, cityPrices.results.map((r) => r.price));

  const distanceFromStationM =
    typeof body.gpsLat === "number" && typeof body.gpsLng === "number"
      ? haversineMeters(body.gpsLat, body.gpsLng, station.latitude, station.longitude)
      : null;

  const status = outlier ? "pending_review" : "accepted";
  const reportId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO price_reports
         (id, gas_station_id, fuel_type, price, reported_by_user_id, report_type, pix_discount, cash_discount,
          device_id, gps_lat, gps_lng, distance_from_station_m, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'manual_report', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      reportId,
      gasStationId,
      fuelType,
      price,
      userId,
      body.pixDiscount ? 1 : 0,
      body.cashDiscount ? 1 : 0,
      deviceId,
      body.gpsLat ?? null,
      body.gpsLng ?? null,
      distanceFromStationM,
      status,
      now
    )
    .run();

  if (status === "accepted") {
    await applyAcceptedPriceReport(db, {
      gasStationId,
      fuelType: fuelType as FuelType,
      price,
      pixDiscount: !!body.pixDiscount,
      cashDiscount: !!body.cashDiscount,
      reportId,
      changedBy: userId,
    });
  }

  return c.json({ id: reportId, status });
});
