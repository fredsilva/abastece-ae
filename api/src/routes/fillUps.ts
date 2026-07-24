import { Hono } from "hono";
import { requireUser } from "../middleware/requireUser";
import { haversineMeters } from "../lib/geo";
import { isPriceOutlier } from "../lib/stats";
import { applyAcceptedPriceReport } from "../lib/applyPriceReport";

type FuelType = "gasolina" | "etanol" | "diesel";
const FUEL_TYPES: FuelType[] = ["gasolina", "etanol", "diesel"];

const PRICE_MIN = 1;
const PRICE_MAX = 15;
const LITERS_MIN = 1;
const LITERS_MAX = 500;

// "Abasteceu?" exige confirmação de proximidade real (diferente do /price-reports, onde o GPS
// é só um sinal de confiança opcional) — ver PLANO-MVP.md, anti-fraude item 3.
const PROXIMITY_LIMIT_M = 150;

const COOLDOWN_MINUTES = 30;
const DAILY_LIMIT = 20;

export const fillUps = new Hono<{ Bindings: Env; Variables: { userId: string; userEmail: string } }>();

fillUps.post("/", requireUser, async (c) => {
  const body = await c.req.json<{
    gasStationId?: string;
    fuelType?: string;
    price?: number;
    liters?: number;
    pixDiscount?: boolean;
    cashDiscount?: boolean;
    deviceId?: string;
    gpsLat?: number;
    gpsLng?: number;
  }>();

  const { gasStationId, fuelType, price, liters, deviceId, gpsLat, gpsLng } = body;
  if (
    !gasStationId ||
    !fuelType ||
    !FUEL_TYPES.includes(fuelType as FuelType) ||
    typeof price !== "number" ||
    typeof liters !== "number" ||
    !deviceId
  ) {
    return c.json({ error: "campos obrigatórios: gasStationId, fuelType, price, liters, deviceId" }, 400);
  }
  if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) {
    return c.json({ error: `preço deve estar entre R$${PRICE_MIN.toFixed(2)} e R$${PRICE_MAX.toFixed(2)}` }, 400);
  }
  if (!Number.isFinite(liters) || liters < LITERS_MIN || liters > LITERS_MAX) {
    return c.json({ error: `litros deve estar entre ${LITERS_MIN} e ${LITERS_MAX}` }, 400);
  }
  if (typeof gpsLat !== "number" || typeof gpsLng !== "number" || !Number.isFinite(gpsLat) || !Number.isFinite(gpsLng)) {
    return c.json({ error: "é necessário compartilhar sua localização para confirmar o abastecimento" }, 400);
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

  const distanceFromStationM = haversineMeters(gpsLat, gpsLng, station.latitude, station.longitude);
  if (distanceFromStationM > PROXIMITY_LIMIT_M) {
    return c.json({ error: "você precisa estar no posto para confirmar o abastecimento" }, 400);
  }

  const cooldownSince = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000).toISOString();
  const recent = await db
    .prepare("SELECT id FROM fill_ups WHERE user_id = ? AND gas_station_id = ? AND created_at > ?")
    .bind(userId, gasStationId, cooldownSince)
    .first();
  if (recent) {
    return c.json({ error: "aguarde um pouco antes de registrar outro abastecimento nesse posto" }, 429);
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

  const cityPrices = await db
    .prepare(
      `SELECT fp.price FROM fuel_prices fp
       JOIN gas_stations gs ON gs.id = fp.gas_station_id
       WHERE gs.city_id = ? AND fp.fuel_type = ? AND gs.status = 'active' AND fp.confidence_score > 0`
    )
    .bind(station.city_id, fuelType)
    .all<{ price: number }>();
  const outlier = isPriceOutlier(price, cityPrices.results.map((r) => r.price));

  const status = outlier ? "pending_review" : "accepted";
  const reportId = crypto.randomUUID();
  const fillUpId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO price_reports
         (id, gas_station_id, fuel_type, price, reported_by_user_id, report_type, pix_discount, cash_discount,
          device_id, gps_lat, gps_lng, distance_from_station_m, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'fill_up', ?, ?, ?, ?, ?, ?, ?, ?)`
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
      gpsLat,
      gpsLng,
      distanceFromStationM,
      status,
      now
    )
    .run();

  await db
    .prepare(
      `INSERT INTO fill_ups (id, user_id, gas_station_id, fuel_type, price_per_liter, liters, price_report_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(fillUpId, userId, gasStationId, fuelType, price, liters, reportId, now)
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

  return c.json({ fillUpId, status });
});
