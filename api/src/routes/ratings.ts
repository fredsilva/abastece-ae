import { Hono } from "hono";
import { requireUser } from "../middleware/requireUser";
import { recomputeRatingSummary } from "../lib/ratingSummary";

export const ratings = new Hono<{ Bindings: Env; Variables: { userId: string; userEmail: string } }>();

function isValidStars(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

ratings.post("/", requireUser, async (c) => {
  const body = await c.req.json<{
    fillUpId?: string;
    priceStars?: number;
    qualityStars?: number;
    serviceStars?: number;
  }>();

  const { fillUpId, priceStars, qualityStars, serviceStars } = body;
  if (!fillUpId || !isValidStars(priceStars) || !isValidStars(qualityStars) || !isValidStars(serviceStars)) {
    return c.json({ error: "campos obrigatórios: fillUpId, priceStars, qualityStars, serviceStars (1 a 5)" }, 400);
  }

  const userId = c.get("userId");
  const db = c.env.DB;

  const fillUp = await db
    .prepare("SELECT id, user_id, gas_station_id FROM fill_ups WHERE id = ?")
    .bind(fillUpId)
    .first<{ id: string; user_id: string; gas_station_id: string }>();
  if (!fillUp) {
    return c.json({ error: "abastecimento não encontrado" }, 404);
  }
  if (fillUp.user_id !== userId) {
    return c.json({ error: "não autorizado" }, 403);
  }

  const existing = await db.prepare("SELECT id FROM ratings WHERE fill_up_id = ?").bind(fillUpId).first();
  if (existing) {
    return c.json({ error: "esse abastecimento já foi avaliado" }, 409);
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO ratings (id, fill_up_id, gas_station_id, user_id, price_stars, quality_stars, service_stars, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, fillUpId, fillUp.gas_station_id, userId, priceStars, qualityStars, serviceStars, new Date().toISOString())
    .run();

  await recomputeRatingSummary(db, fillUp.gas_station_id);

  return c.json({ id, gasStationId: fillUp.gas_station_id });
});
