import { Hono } from "hono";

type FuelType = "gasolina" | "etanol" | "diesel";

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
