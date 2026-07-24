import { Hono } from "hono";
import { applyAcceptedPriceReport } from "../lib/applyPriceReport";

type FuelType = "gasolina" | "etanol" | "diesel";
const FUEL_TYPES: FuelType[] = ["gasolina", "etanol", "diesel"];

interface StationRow {
  id: string;
  cnpj: string | null;
  nome_fantasia: string;
  razao_social: string | null;
  brand: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  latitude: number;
  longitude: number;
  city_id: string;
  source: string;
  verified: number;
  status: string;
  created_at: string;
  updated_at: string | null;
  fuel_type: FuelType | null;
  price: number | null;
  confidence_score: number | null;
  price_changed_at: string | null;
}

function groupStations(rows: StationRow[]) {
  const byId = new Map<string, ReturnType<typeof toStation>>();
  for (const row of rows) {
    let station = byId.get(row.id);
    if (!station) {
      station = toStation(row);
      byId.set(row.id, station);
    }
    if (row.fuel_type) {
      station.prices[row.fuel_type] = {
        price: row.price!,
        confidenceScore: row.confidence_score!,
        priceChangedAt: row.price_changed_at!,
      };
    }
  }
  return Array.from(byId.values());
}

function toStation(row: StationRow) {
  return {
    id: row.id,
    cnpj: row.cnpj,
    nomeFantasia: row.nome_fantasia,
    razaoSocial: row.razao_social,
    brand: row.brand,
    addressStreet: row.address_street,
    addressNumber: row.address_number,
    addressNeighborhood: row.address_neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    cityId: row.city_id,
    source: row.source,
    verified: row.verified === 1,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    prices: {} as Record<FuelType, { price: number; confidenceScore: number; priceChangedAt: string }>,
  };
}

function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function citySlug(city: string, uf: string): string {
  return `${normalizeText(city).toLowerCase().replace(/\s+/g, "-")}-${uf.toLowerCase()}`;
}

export const admin = new Hono<{ Bindings: Env; Variables: { accessEmail?: string } }>();

admin.get("/stations", async (c) => {
  const cityId = c.req.query("city_id");

  const query = cityId
    ? c.env.DB.prepare(
        `SELECT gs.*, fp.fuel_type, fp.price, fp.confidence_score, fp.price_changed_at
         FROM gas_stations gs
         LEFT JOIN fuel_prices fp ON fp.gas_station_id = gs.id
         WHERE gs.city_id = ?
         ORDER BY gs.nome_fantasia`
      ).bind(cityId)
    : c.env.DB.prepare(
        `SELECT gs.*, fp.fuel_type, fp.price, fp.confidence_score, fp.price_changed_at
         FROM gas_stations gs
         LEFT JOIN fuel_prices fp ON fp.gas_station_id = gs.id
         ORDER BY gs.city_id, gs.nome_fantasia`
      );

  const { results } = await query.all<StationRow>();
  return c.json({ stations: groupStations(results) });
});

admin.post("/stations", async (c) => {
  const body = await c.req.json<{
    nomeFantasia: string;
    razaoSocial?: string;
    cnpj?: string;
    brand?: string;
    addressStreet?: string;
    addressNumber?: string;
    addressNeighborhood?: string;
    city: string;
    state: string;
    postalCode?: string;
    latitude: number;
    longitude: number;
    cityId: string;
  }>();

  if (!body.nomeFantasia || !body.city || !body.state || !body.cityId) {
    return c.json({ error: "nomeFantasia, city, state e cityId são obrigatórios" }, 400);
  }
  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return c.json({ error: "latitude e longitude são obrigatórios" }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO gas_stations
       (id, cnpj, nome_fantasia, razao_social, brand, address_street, address_number,
        address_neighborhood, city, state, postal_code, latitude, longitude, city_id,
        source, verified, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', 0, 'active', ?, ?)`
  )
    .bind(
      id,
      body.cnpj ?? null,
      body.nomeFantasia,
      body.razaoSocial ?? null,
      body.brand ?? null,
      body.addressStreet ?? null,
      body.addressNumber ?? null,
      body.addressNeighborhood ?? null,
      body.city,
      body.state,
      body.postalCode ?? null,
      body.latitude,
      body.longitude,
      body.cityId,
      now,
      now
    )
    .run();

  return c.json({ id }, 201);
});

interface BulkImportPosto {
  nome?: string;
  bandeira?: string | null;
  cidade?: string;
  estado?: string;
  endereco?: string | null;
  localizacao?: { latitude?: number; longitude?: number };
  google_place_id?: string | null;
}

admin.post("/stations/bulk-import", async (c) => {
  const body = await c.req.json<{ postos?: BulkImportPosto[] }>();
  const postos = body.postos;

  if (!Array.isArray(postos) || postos.length === 0) {
    return c.json({ error: "corpo deve conter um array 'postos' não vazio" }, 400);
  }

  let imported = 0;
  const skipped: { nome: string; reason: string }[] = [];

  for (const posto of postos) {
    const nome = posto.nome?.trim();
    const cidade = posto.cidade?.trim();
    const estado = posto.estado?.trim();
    const lat = posto.localizacao?.latitude;
    const lng = posto.localizacao?.longitude;

    if (!nome || !cidade || !estado || typeof lat !== "number" || typeof lng !== "number") {
      skipped.push({ nome: nome ?? "(sem nome)", reason: "campos obrigatórios ausentes (nome/cidade/estado/localização)" });
      continue;
    }

    const placeId = posto.google_place_id ?? null;
    const cityId = citySlug(cidade, estado);

    if (placeId) {
      const existing = await c.env.DB.prepare("SELECT id FROM gas_stations WHERE google_place_id = ?").bind(placeId).first();
      if (existing) {
        skipped.push({ nome, reason: "já importado (mesmo google_place_id)" });
        continue;
      }
    } else {
      const existing = await c.env.DB.prepare(
        "SELECT id FROM gas_stations WHERE city_id = ? AND LOWER(nome_fantasia) = LOWER(?)"
      )
        .bind(cityId, nome)
        .first();
      if (existing) {
        skipped.push({ nome, reason: "posto com o mesmo nome já cadastrado nesta cidade" });
        continue;
      }
    }

    const postalCodeMatch = posto.endereco?.match(/\d{5}-?\d{3}/);
    const brand = posto.bandeira && posto.bandeira !== "Independente" ? posto.bandeira : null;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO gas_stations
         (id, nome_fantasia, brand, address_street, city, state, postal_code,
          latitude, longitude, city_id, source, verified, status, google_place_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', 0, 'active', ?, ?, ?)`
    )
      .bind(id, nome, brand, posto.endereco ?? null, cidade, estado, postalCodeMatch?.[0] ?? null, lat, lng, cityId, placeId, now, now)
      .run();

    imported++;
  }

  return c.json({ imported, skippedCount: skipped.length, skipped, total: postos.length });
});

const EDITABLE_COLUMNS: Record<string, string> = {
  nomeFantasia: "nome_fantasia",
  razaoSocial: "razao_social",
  cnpj: "cnpj",
  brand: "brand",
  addressStreet: "address_street",
  addressNumber: "address_number",
  addressNeighborhood: "address_neighborhood",
  city: "city",
  state: "state",
  postalCode: "postal_code",
  latitude: "latitude",
  longitude: "longitude",
  status: "status",
  verified: "verified",
};

admin.put("/stations/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(EDITABLE_COLUMNS)) {
    if (key in body) {
      setClauses.push(`${column} = ?`);
      values.push(key === "verified" ? (body[key] ? 1 : 0) : body[key]);
    }
  }

  if (setClauses.length === 0) {
    return c.json({ error: "nenhum campo editável enviado" }, 400);
  }

  setClauses.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  const result = await c.env.DB.prepare(
    `UPDATE gas_stations SET ${setClauses.join(", ")} WHERE id = ?`
  )
    .bind(...values)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "posto não encontrado" }, 404);
  }

  return c.json({ ok: true });
});

admin.put("/stations/:id/prices", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Partial<Record<FuelType, number | null>>>();
  const changedBy = c.get("accessEmail") ?? null;

  const station = await c.env.DB.prepare("SELECT id FROM gas_stations WHERE id = ?").bind(id).first();
  if (!station) {
    return c.json({ error: "posto não encontrado" }, 404);
  }

  const now = new Date().toISOString();

  for (const fuelType of FUEL_TYPES) {
    if (!(fuelType in body)) continue;
    const price = body[fuelType];

    const existing = await c.env.DB.prepare("SELECT price FROM fuel_prices WHERE gas_station_id = ? AND fuel_type = ?")
      .bind(id, fuelType)
      .first<{ price: number }>();

    if (price === null) {
      if (existing) {
        await c.env.DB.prepare("DELETE FROM fuel_prices WHERE gas_station_id = ? AND fuel_type = ?").bind(id, fuelType).run();
      }
      continue;
    }

    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      return c.json({ error: `preço inválido para ${fuelType}` }, 400);
    }

    if (existing && existing.price === price) {
      // preço não mudou de fato — só marca que foi confirmado agora, sem gerar entrada de histórico
      await c.env.DB.prepare("UPDATE fuel_prices SET last_reported_at = ? WHERE gas_station_id = ? AND fuel_type = ?")
        .bind(now, id, fuelType)
        .run();
      continue;
    }

    const previousPrice = existing?.price ?? null;

    await c.env.DB.prepare(
      `INSERT INTO fuel_prices (gas_station_id, fuel_type, price, previous_price, price_changed_at, last_reported_at, confidence_score)
       VALUES (?, ?, ?, ?, ?, ?, 1.0)
       ON CONFLICT(gas_station_id, fuel_type) DO UPDATE SET
         previous_price = excluded.previous_price,
         price = excluded.price,
         price_changed_at = excluded.price_changed_at,
         last_reported_at = excluded.last_reported_at,
         confidence_score = 1.0`
    )
      .bind(id, fuelType, price, previousPrice, now, now)
      .run();

    await c.env.DB.prepare(
      `INSERT INTO fuel_price_history (id, gas_station_id, fuel_type, price, previous_price, source, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, 'admin', ?, ?)`
    )
      .bind(crypto.randomUUID(), id, fuelType, price, previousPrice, changedBy, now)
      .run();
  }

  return c.json({ ok: true });
});

interface PriceHistoryRow {
  id: string;
  fuel_type: FuelType;
  price: number;
  previous_price: number | null;
  source: "admin" | "user_report";
  changed_by: string | null;
  changed_at: string;
}

admin.get("/stations/:id/prices/history", async (c) => {
  const id = c.req.param("id");
  const fuelType = c.req.query("fuel_type");

  const query = fuelType
    ? c.env.DB.prepare(
        `SELECT id, fuel_type, price, previous_price, source, changed_by, changed_at
         FROM fuel_price_history
         WHERE gas_station_id = ? AND fuel_type = ?
         ORDER BY changed_at DESC`
      ).bind(id, fuelType)
    : c.env.DB.prepare(
        `SELECT id, fuel_type, price, previous_price, source, changed_by, changed_at
         FROM fuel_price_history
         WHERE gas_station_id = ?
         ORDER BY changed_at DESC`
      ).bind(id);

  const { results } = await query.all<PriceHistoryRow>();

  return c.json({
    history: results.map((row) => ({
      id: row.id,
      fuelType: row.fuel_type,
      price: row.price,
      previousPrice: row.previous_price,
      source: row.source,
      changedBy: row.changed_by,
      changedAt: row.changed_at,
    })),
  });
});

interface PriceReportRow {
  id: string;
  gas_station_id: string;
  station_name: string;
  fuel_type: FuelType;
  price: number;
  pix_discount: number;
  cash_discount: number;
  reporter_email: string;
  distance_from_station_m: number | null;
  created_at: string;
}

admin.get("/price-reports", async (c) => {
  const status = c.req.query("status") ?? "pending_review";

  const { results } = await c.env.DB.prepare(
    `SELECT pr.id, pr.gas_station_id, gs.nome_fantasia as station_name, pr.fuel_type, pr.price,
            pr.pix_discount, pr.cash_discount, u.email as reporter_email, pr.distance_from_station_m, pr.created_at
     FROM price_reports pr
     JOIN gas_stations gs ON gs.id = pr.gas_station_id
     JOIN users u ON u.id = pr.reported_by_user_id
     WHERE pr.status = ?
     ORDER BY pr.created_at DESC`
  )
    .bind(status)
    .all<PriceReportRow>();

  return c.json({
    reports: results.map((row) => ({
      id: row.id,
      gasStationId: row.gas_station_id,
      stationName: row.station_name,
      fuelType: row.fuel_type,
      price: row.price,
      pixDiscount: row.pix_discount === 1,
      cashDiscount: row.cash_discount === 1,
      reporterEmail: row.reporter_email,
      distanceFromStationM: row.distance_from_station_m,
      createdAt: row.created_at,
    })),
  });
});

admin.post("/price-reports/:id/approve", async (c) => {
  const id = c.req.param("id");

  const report = await c.env.DB.prepare(
    "SELECT id, gas_station_id, fuel_type, price, pix_discount, cash_discount, status FROM price_reports WHERE id = ?"
  )
    .bind(id)
    .first<{
      id: string;
      gas_station_id: string;
      fuel_type: FuelType;
      price: number;
      pix_discount: number;
      cash_discount: number;
      status: string;
    }>();

  if (!report) {
    return c.json({ error: "report não encontrado" }, 404);
  }
  if (report.status !== "pending_review") {
    return c.json({ error: "report não está pendente de revisão" }, 400);
  }

  await applyAcceptedPriceReport(c.env.DB, {
    gasStationId: report.gas_station_id,
    fuelType: report.fuel_type,
    price: report.price,
    pixDiscount: report.pix_discount === 1,
    cashDiscount: report.cash_discount === 1,
    reportId: report.id,
    changedBy: c.get("accessEmail") ?? "admin",
  });

  await c.env.DB.prepare("UPDATE price_reports SET status = 'accepted' WHERE id = ?").bind(id).run();

  return c.json({ ok: true });
});

admin.post("/price-reports/:id/reject", async (c) => {
  const id = c.req.param("id");

  const result = await c.env.DB.prepare(
    "UPDATE price_reports SET status = 'rejected_outlier' WHERE id = ? AND status = 'pending_review'"
  )
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "report não encontrado ou já processado" }, 404);
  }

  return c.json({ ok: true });
});
