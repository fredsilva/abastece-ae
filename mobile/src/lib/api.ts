const API_BASE = "https://abastece-ae-api.fredsilva-sistemas.workers.dev";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type FuelType = "gasolina" | "etanol" | "diesel";

export interface AuthUser {
  id: string;
  email: string;
  defaultFuelTab: FuelType;
}

export interface Station {
  id: string;
  nomeFantasia: string;
  brand: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressNeighborhood: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
  price: number;
  previousPrice: number | null;
  priceChangedAt: string;
  lastReportedAt: string;
  pixDiscount: boolean;
  cashDiscount: boolean;
  confidenceScore: number;
  ratingAvg: number | null;
  ratingsCount: number;
  cheapest: boolean;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export async function requestMagicLink(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/email/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  await handle(res);
}

export async function verifyMagicLink(token: string): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/auth/email/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return handle(res);
}

export async function refreshSession(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  return handle(res);
}

export async function getMe(accessToken: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handle(res);
}

export async function fetchStations(params: {
  fuel: FuelType;
  latitude?: number;
  longitude?: number;
}): Promise<Station[]> {
  const query = new URLSearchParams({ fuel: params.fuel });
  if (params.latitude !== undefined && params.longitude !== undefined) {
    query.set("lat", String(params.latitude));
    query.set("lng", String(params.longitude));
  }
  const res = await fetch(`${API_BASE}/stations?${query.toString()}`);
  const body = await handle<{ stations: Station[] }>(res);
  return body.stations;
}

export async function updateDefaultFuelTab(accessToken: string, defaultFuelTab: FuelType): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/me/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ defaultFuelTab }),
  });
  await handle(res);
}

export interface ReportPriceInput {
  gasStationId: string;
  fuelType: FuelType;
  price: number;
  pixDiscount: boolean;
  cashDiscount: boolean;
  deviceId: string;
  gpsLat?: number;
  gpsLng?: number;
}

export async function reportPrice(
  accessToken: string,
  input: ReportPriceInput
): Promise<{ id: string; status: "accepted" | "pending_review" }> {
  const res = await fetch(`${API_BASE}/price-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  });
  return handle(res);
}

export interface FillUpInput {
  gasStationId: string;
  fuelType: FuelType;
  price: number;
  liters: number;
  pixDiscount: boolean;
  cashDiscount: boolean;
  deviceId: string;
  gpsLat: number;
  gpsLng: number;
}

export async function submitFillUp(
  accessToken: string,
  input: FillUpInput
): Promise<{ fillUpId: string; status: "accepted" | "pending_review" }> {
  const res = await fetch(`${API_BASE}/fill-ups`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  });
  return handle(res);
}

export interface RatingInput {
  fillUpId: string;
  priceStars: number;
  qualityStars: number;
  serviceStars: number;
}

export async function submitRating(accessToken: string, input: RatingInput): Promise<{ id: string; gasStationId: string }> {
  const res = await fetch(`${API_BASE}/ratings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  });
  return handle(res);
}

export async function logoutSession(refreshToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  await handle(res);
}
