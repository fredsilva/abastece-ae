// Seed one-off: importa postos + preços da ANP para uma cidade piloto e gera um arquivo
// .sql pronto para `wrangler d1 execute --file`. Ver PLANO-MVP.md (seção "Seed inicial de
// postos") para o desenho completo.
//
// Uso:
//   npx tsx scripts/seed-anp.ts \
//     --city "Paraíso do Tocantins" --uf TO \
//     --cadastro scripts/data/anp_cadastro.csv \
//     --precos scripts/data/anp_precos_gasolina_etanol_2026_06.csv \
//     --precos scripts/data/anp_precos_diesel_gnv_2026_06.csv \
//     --out scripts/output/seed-paraiso-do-tocantins-to.sql
//
// Os CSVs de origem devem ser baixados manualmente (ver scripts/README.md) porque o site
// da ANP bloqueia requisições feitas pelo fetch do Node (WAF por fingerprint de TLS);
// curl com --ssl-no-revoke funciona. A geocodificação usa o token em MAPBOX_TOKEN
// (scripts/.env, carregado via --env-file do Node).

import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const MAPBOX_GEOCODE_URL = "https://api.mapbox.com/search/geocode/v6/forward";
const GEOCODE_DELAY_MS = 120;

type FuelType = "gasolina" | "etanol" | "diesel";

interface CadastroRow {
  cnpj: string;
  razaoSocial: string;
  endereco: string;
  complemento: string;
  bairro: string;
  cep: string;
  uf: string;
  municipio: string;
  bandeira: string;
}

interface PriceRow {
  cnpj: string;
  fuel: FuelType;
  produtoRaw: string;
  dateIso: string;
  price: number;
}

interface StationSeed {
  id: string;
  cnpj: string;
  nomeFantasia: string;
  razaoSocial: string;
  brand: string;
  street: string;
  number: string | null;
  neighborhood: string;
  city: string;
  uf: string;
  postalCode: string;
  cityId: string;
  latitude: number;
  longitude: number;
}

// ---------- args ----------

function parseArgs(argv: string[]) {
  const out: {
    city?: string;
    uf?: string;
    cadastro?: string;
    precos: string[];
    out?: string;
  } = { precos: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--city":
        out.city = next();
        break;
      case "--uf":
        out.uf = next();
        break;
      case "--cadastro":
        out.cadastro = next();
        break;
      case "--precos":
        out.precos.push(next());
        break;
      case "--out":
        out.out = next();
        break;
      default:
        throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }

  if (!out.city || !out.uf || !out.cadastro || out.precos.length === 0 || !out.out) {
    throw new Error(
      "Uso: seed-anp.ts --city <cidade> --uf <UF> --cadastro <csv> --precos <csv> [--precos <csv> ...] --out <sql>"
    );
  }

  return out as { city: string; uf: string; cadastro: string; precos: string[]; out: string };
}

// ---------- helpers de texto ----------

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

const LOWERCASE_CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e"]);

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => {
      if (w.length === 0) return w;
      if (i > 0 && LOWERCASE_CONNECTORS.has(w)) return w;
      return w[0]!.toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function normalizeCnpj(s: string): string {
  return s.replace(/\D/g, "");
}

function sqlEscape(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

function brToIso(dateBr: string): string {
  const [d, m, y] = dateBr.trim().split("/");
  return `${y}-${m}-${d}`;
}

function parsePrice(s: string): number {
  return parseFloat(s.trim().replace(",", "."));
}

function citySlug(city: string, uf: string): string {
  return `${normalize(city).toLowerCase().replace(/\s+/g, "-")}-${uf.toLowerCase()}`;
}

// Endereço da ANP costuma vir como "AVENIDA TRANSBRASILIANA,  961" (rua + número
// separados pela última vírgula). Quando não há vírgula, ou o trecho final não é
// numérico, tratamos o endereço inteiro como nome da rua.
function splitStreetNumber(endereco: string): { street: string; number: string | null } {
  const idx = endereco.lastIndexOf(",");
  if (idx === -1) return { street: endereco.trim(), number: null };
  const street = endereco.slice(0, idx).trim();
  const rest = endereco.slice(idx + 1).trim();
  if (/^\d+$/.test(rest)) return { street, number: rest };
  return { street: endereco.trim(), number: null };
}

// ---------- CSV parsing (delimitado por ";", sem aspas nos arquivos da ANP) ----------

function readCsvRows(path: string): string[][] {
  const raw = readFileSync(path, "utf-8").replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  return lines.slice(1).map((line) => line.split(";"));
}

function loadCadastro(path: string, city: string, uf: string): CadastroRow[] {
  const targetCity = normalize(city);
  const targetUf = uf.toUpperCase();
  const rows = readCsvRows(path);
  const result: CadastroRow[] = [];

  for (const cols of rows) {
    // CODIGOISIMP;AUTORIZACAO;DATAPUBLICACAO;RAZAOSOCIAL;CNPJ;ENDERECO;COMPLEMENTO;BAIRRO;CEP;UF;MUNICIPIO;BANDEIRA;DATAVINCULACAO
    const [, , , razaoSocial, cnpj, endereco, complemento, bairro, cep, ufCol, municipio, bandeira] = cols;
    if (!ufCol || !municipio) continue;
    if (ufCol.trim() !== targetUf) continue;
    if (normalize(municipio) !== targetCity) continue;

    result.push({
      cnpj: normalizeCnpj(cnpj ?? ""),
      razaoSocial: (razaoSocial ?? "").trim(),
      endereco: (endereco ?? "").trim(),
      complemento: (complemento ?? "").trim(),
      bairro: (bairro ?? "").trim(),
      cep: (cep ?? "").trim(),
      uf: ufCol.trim(),
      municipio: municipio.trim(),
      bandeira: (bandeira ?? "").trim(),
    });
  }

  return result;
}

function fuelFromProduto(produtoRaw: string): FuelType | null {
  const p = normalize(produtoRaw);
  if (p === "GASOLINA") return "gasolina";
  if (p === "ETANOL") return "etanol";
  if (p === "DIESEL" || p === "DIESEL S10") return "diesel";
  return null; // GASOLINA ADITIVADA, GNV, GLP etc. ficam de fora do MVP
}

function loadPriceRows(path: string, city: string, uf: string): PriceRow[] {
  const targetCity = normalize(city);
  const targetUf = uf.toUpperCase();
  const rows = readCsvRows(path);
  const result: PriceRow[] = [];

  for (const cols of rows) {
    // Regiao - Sigla;Estado - Sigla;Municipio;Revenda;CNPJ da Revenda;Nome da Rua;Numero Rua;
    // Complemento;Bairro;Cep;Produto;Data da Coleta;Valor de Venda;Valor de Compra;Unidade de Medida;Bandeira
    const [, ufCol, municipio, , cnpjCol, , , , , , produto, dataColeta, valorVenda] = cols;
    if (!ufCol || !municipio || !produto || !dataColeta || !valorVenda) continue;
    if (ufCol.trim() !== targetUf) continue;
    if (normalize(municipio) !== targetCity) continue;

    const fuel = fuelFromProduto(produto);
    if (!fuel) continue;

    const price = parsePrice(valorVenda);
    if (!Number.isFinite(price) || price <= 0) continue;

    result.push({
      cnpj: normalizeCnpj(cnpjCol ?? ""),
      fuel,
      produtoRaw: produto.trim(),
      dateIso: brToIso(dataColeta),
      price,
    });
  }

  return result;
}

// Mantém só a cotação mais recente por posto+combustível; em empate de data para diesel,
// prefere "DIESEL S10" sobre "DIESEL" comum.
function latestByStationFuel(rows: PriceRow[]): Map<string, PriceRow> {
  const map = new Map<string, PriceRow>();
  for (const row of rows) {
    const key = `${row.cnpj}|${row.fuel}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, row);
      continue;
    }
    if (row.dateIso > current.dateIso) {
      map.set(key, row);
    } else if (
      row.dateIso === current.dateIso &&
      row.produtoRaw.toUpperCase() === "DIESEL S10" &&
      current.produtoRaw.toUpperCase() !== "DIESEL S10"
    ) {
      map.set(key, row);
    }
  }
  return map;
}

interface CityAverage {
  fuel: FuelType;
  avg: number;
  min: number;
  max: number;
  count: number;
  latestDateIso: string;
}

function computeCityAverages(latest: Map<string, PriceRow>): Map<FuelType, CityAverage> {
  const byFuel = new Map<FuelType, PriceRow[]>();
  for (const row of latest.values()) {
    const list = byFuel.get(row.fuel) ?? [];
    list.push(row);
    byFuel.set(row.fuel, list);
  }

  const result = new Map<FuelType, CityAverage>();
  for (const [fuel, list] of byFuel) {
    const prices = list.map((r) => r.price);
    const latestDateIso = list.reduce((max, r) => (r.dateIso > max ? r.dateIso : max), list[0]!.dateIso);
    result.set(fuel, {
      fuel,
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      count: prices.length,
      latestDateIso,
    });
  }
  return result;
}

function mondayOf(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = domingo
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ---------- geocoding (Mapbox v6, structured input) ----------

interface GeocodeCache {
  [key: string]: { lat: number; lng: number } | null;
}

function loadCache(path: string): GeocodeCache {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8"));
}

function saveCache(path: string, cache: GeocodeCache) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cache, null, 2));
}

async function geocode(
  row: CadastroRow,
  city: string,
  token: string
): Promise<{ lat: number; lng: number } | null> {
  const { street, number } = splitStreetNumber(row.endereco);
  const params = new URLSearchParams({
    street,
    place: city,
    region: row.uf,
    country: "br",
    autocomplete: "false",
    limit: "1",
    access_token: token,
  });
  if (number) params.set("address_number", number);
  if (row.cep) params.set("postcode", row.cep);

  const res = await fetch(`${MAPBOX_GEOCODE_URL}?${params.toString()}`);
  if (!res.ok) {
    console.warn(`  geocoding HTTP ${res.status} para "${row.endereco}"`);
    return null;
  }
  const json = (await res.json()) as {
    features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
  };
  const coords = json.features?.[0]?.geometry?.coordinates;
  if (!coords) return null;
  return { lng: coords[0]!, lat: coords[1]! };
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mapboxToken = process.env.MAPBOX_TOKEN;
  if (!mapboxToken) {
    throw new Error("MAPBOX_TOKEN não definido (rode com `node --env-file scripts/.env`)");
  }

  console.log(`Carregando cadastro ANP para ${args.city}/${args.uf}...`);
  const cadastro = loadCadastro(args.cadastro, args.city, args.uf);
  console.log(`  ${cadastro.length} posto(s) encontrados no cadastro.`);
  if (cadastro.length === 0) {
    throw new Error("Nenhum posto encontrado para essa cidade/UF no arquivo de cadastro.");
  }

  console.log("Carregando pesquisas de preço...");
  const allPriceRows = args.precos.flatMap((p) => loadPriceRows(p, args.city, args.uf));
  const latest = latestByStationFuel(allPriceRows);
  const cityAverages = computeCityAverages(latest);
  console.log(`  ${latest.size} cotação(ões) posto+combustível encontradas.`);
  for (const [fuel, avg] of cityAverages) {
    console.log(
      `  média ${fuel}: R$ ${avg.avg.toFixed(2)} (min ${avg.min.toFixed(2)}, max ${avg.max.toFixed(2)}, ${avg.count} posto(s))`
    );
  }

  const cityId = citySlug(args.city, args.uf);
  const cityTitle = toTitleCase(args.city);
  const cachePath = "data/geocode-cache.json";
  const cache = loadCache(cachePath);

  console.log("Geocodificando endereços (Mapbox)...");
  const stations: StationSeed[] = [];
  const failedGeocodes: string[] = [];

  for (const row of cadastro) {
    const cacheKey = row.cnpj || `${row.endereco}|${row.bairro}`;
    let coords = cache[cacheKey];
    if (coords === undefined) {
      coords = await geocode(row, cityTitle, mapboxToken);
      cache[cacheKey] = coords;
      await new Promise((r) => setTimeout(r, GEOCODE_DELAY_MS));
    }

    if (!coords) {
      failedGeocodes.push(`${row.razaoSocial} — ${row.endereco}`);
      continue;
    }

    const { street, number } = splitStreetNumber(row.endereco);
    stations.push({
      id: randomUUID(),
      cnpj: row.cnpj,
      nomeFantasia: toTitleCase(row.razaoSocial),
      razaoSocial: row.razaoSocial,
      brand: toTitleCase(row.bandeira || "Bandeira Branca"),
      street: toTitleCase(street),
      number,
      neighborhood: toTitleCase(row.bairro),
      city: cityTitle,
      uf: row.uf,
      postalCode: row.cep,
      cityId,
      latitude: coords.lat,
      longitude: coords.lng,
    });
  }
  saveCache(cachePath, cache);

  console.log(`  ${stations.length} posto(s) geocodificado(s) com sucesso.`);
  if (failedGeocodes.length > 0) {
    console.warn(`  ${failedGeocodes.length} posto(s) SEM geocodificação (revisar manualmente):`);
    for (const f of failedGeocodes) console.warn(`    - ${f}`);
  }

  // ---------- gerar SQL ----------

  const now = new Date().toISOString();
  const lines: string[] = [];
  lines.push(`-- Seed ANP gerado em ${now} para ${cityTitle}/${args.uf} (city_id=${cityId})`);
  lines.push("");

  for (const s of stations) {
    lines.push(
      `INSERT INTO gas_stations (id, cnpj, nome_fantasia, razao_social, brand, address_street, address_number, address_neighborhood, city, state, postal_code, latitude, longitude, city_id, source, verified, status, created_at, updated_at) VALUES (` +
        [
          sqlEscape(s.id),
          sqlEscape(s.cnpj),
          sqlEscape(s.nomeFantasia),
          sqlEscape(s.razaoSocial),
          sqlEscape(s.brand),
          sqlEscape(s.street),
          sqlEscape(s.number),
          sqlEscape(s.neighborhood),
          sqlEscape(s.city),
          sqlEscape(s.uf),
          sqlEscape(s.postalCode),
          sqlEscape(s.latitude),
          sqlEscape(s.longitude),
          sqlEscape(s.cityId),
          sqlEscape("anp_seed"),
          "0",
          sqlEscape("active"),
          sqlEscape(now),
          sqlEscape(now),
        ].join(", ") +
        ");"
    );
  }

  lines.push("");

  let realCount = 0;
  let fallbackCount = 0;

  for (const s of stations) {
    for (const fuel of ["gasolina", "etanol", "diesel"] as FuelType[]) {
      const real = latest.get(`${s.cnpj}|${fuel}`);
      const cityAvg = cityAverages.get(fuel);

      let price: number;
      let changedAt: string;
      let confidence: number;

      if (real) {
        price = real.price;
        changedAt = `${real.dateIso}T00:00:00.000Z`;
        confidence = 0.6; // pesquisa oficial ANP por posto, ainda não verificado pela comunidade
        realCount++;
      } else if (cityAvg) {
        price = Math.round(cityAvg.avg * 100) / 100;
        changedAt = now;
        confidence = 0; // estimativa (média municipal), rotular na UI como "aguardando confirmação"
        fallbackCount++;
      } else {
        continue; // sem nenhum dado de preço para esse combustível na cidade inteira
      }

      lines.push(
        `INSERT INTO fuel_prices (gas_station_id, fuel_type, price, previous_price, price_changed_at, last_reported_at, pix_discount, cash_discount, confidence_score) VALUES (` +
          [
            sqlEscape(s.id),
            sqlEscape(fuel),
            sqlEscape(price),
            "NULL",
            sqlEscape(changedAt),
            sqlEscape(changedAt),
            "0",
            "0",
            sqlEscape(confidence),
          ].join(", ") +
          ");"
      );
    }
  }

  lines.push("");

  for (const [fuel, avg] of cityAverages) {
    lines.push(
      `INSERT INTO anp_reference_prices (city_id, fuel_type, week_start, avg_price, min_price, max_price) VALUES (` +
        [
          sqlEscape(cityId),
          sqlEscape(fuel),
          sqlEscape(mondayOf(avg.latestDateIso)),
          sqlEscape(Math.round(avg.avg * 100) / 100),
          sqlEscape(avg.min),
          sqlEscape(avg.max),
        ].join(", ") +
        ");"
    );
  }

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, lines.join("\n") + "\n");

  console.log("");
  console.log(`SQL gerado em ${args.out}`);
  console.log(
    `  ${stations.length} postos · ${realCount} preços reais (pesquisa ANP) · ${fallbackCount} preços estimados (média municipal)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
