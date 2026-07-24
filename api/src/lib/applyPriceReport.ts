type FuelType = "gasolina" | "etanol" | "diesel";

export interface ApplyAcceptedReportInput {
  gasStationId: string;
  fuelType: FuelType;
  price: number;
  pixDiscount: boolean;
  cashDiscount: boolean;
  reportId: string;
  changedBy: string;
}

// Aplica um price_report aceito (direto ou aprovado na moderação) em fuel_prices +
// fuel_price_history. Espelha o padrão já usado em admin.ts (PUT /stations/:id/prices),
// parametrizado para aceitar tanto reports automáticos quanto aprovação manual do admin.
export async function applyAcceptedPriceReport(db: D1Database, input: ApplyAcceptedReportInput): Promise<void> {
  const now = new Date().toISOString();

  const existing = await db
    .prepare("SELECT price FROM fuel_prices WHERE gas_station_id = ? AND fuel_type = ?")
    .bind(input.gasStationId, input.fuelType)
    .first<{ price: number }>();

  if (existing && existing.price === input.price) {
    await db
      .prepare(
        `UPDATE fuel_prices SET last_reported_at = ?, pix_discount = ?, cash_discount = ?, confidence_score = 1.0
         WHERE gas_station_id = ? AND fuel_type = ?`
      )
      .bind(now, input.pixDiscount ? 1 : 0, input.cashDiscount ? 1 : 0, input.gasStationId, input.fuelType)
      .run();
    return;
  }

  const previousPrice = existing?.price ?? null;

  await db
    .prepare(
      `INSERT INTO fuel_prices (gas_station_id, fuel_type, price, previous_price, price_changed_at, last_reported_at, pix_discount, cash_discount, confidence_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1.0)
       ON CONFLICT(gas_station_id, fuel_type) DO UPDATE SET
         previous_price = excluded.previous_price,
         price = excluded.price,
         price_changed_at = excluded.price_changed_at,
         last_reported_at = excluded.last_reported_at,
         pix_discount = excluded.pix_discount,
         cash_discount = excluded.cash_discount,
         confidence_score = 1.0`
    )
    .bind(input.gasStationId, input.fuelType, input.price, previousPrice, now, now, input.pixDiscount ? 1 : 0, input.cashDiscount ? 1 : 0)
    .run();

  await db
    .prepare(
      `INSERT INTO fuel_price_history (id, gas_station_id, fuel_type, price, previous_price, source, changed_by, price_report_id, changed_at)
       VALUES (?, ?, ?, ?, ?, 'user_report', ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), input.gasStationId, input.fuelType, input.price, previousPrice, input.changedBy, input.reportId, now)
    .run();
}
