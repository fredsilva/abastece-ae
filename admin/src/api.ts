import { API_BASE } from "./config";
import type { Config, Metrics, PriceHistoryEntry, PriceReport, Station, StationInput, StationPricesInput, User } from "./types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function listStations(cityId: string): Promise<Station[]> {
  const res = await fetch(`${API_BASE}/admin/stations?city_id=${encodeURIComponent(cityId)}`, {
    credentials: "include",
  });
  const data = await handle<{ stations: Station[] }>(res);
  return data.stations;
}

export async function createStation(input: StationInput): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/admin/stations`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle(res);
}

export async function updateStation(id: string, patch: Partial<StationInput & { status: string; verified: boolean }>): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/stations/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  await handle(res);
}

export async function updateStationPrices(id: string, prices: StationPricesInput): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/stations/${id}/prices`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prices),
  });
  await handle(res);
}

export async function deleteStation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/stations/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await handle(res);
}

export async function bulkDeleteStations(ids: string[]): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/stations/bulk-delete`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  await handle(res);
}

export async function bulkUpdateStationStatus(ids: string[], status: "active" | "inactive"): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/stations/bulk-status`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, status }),
  });
  await handle(res);
}

export async function getStationPriceHistory(id: string): Promise<PriceHistoryEntry[]> {
  const res = await fetch(`${API_BASE}/admin/stations/${id}/prices/history`, {
    credentials: "include",
  });
  const data = await handle<{ history: PriceHistoryEntry[] }>(res);
  return data.history;
}

export interface BulkImportResult {
  imported: number;
  skippedCount: number;
  skipped: { nome: string; reason: string }[];
  total: number;
}

export async function bulkImportStations(payload: { postos: unknown[] }): Promise<BulkImportResult> {
  const res = await fetch(`${API_BASE}/admin/stations/bulk-import`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function listPriceReports(status: string): Promise<PriceReport[]> {
  const res = await fetch(`${API_BASE}/admin/price-reports?status=${encodeURIComponent(status)}`, {
    credentials: "include",
  });
  const data = await handle<{ reports: PriceReport[] }>(res);
  return data.reports;
}

export async function approvePriceReport(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/price-reports/${id}/approve`, {
    method: "POST",
    credentials: "include",
  });
  await handle(res);
}

export async function rejectPriceReport(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/price-reports/${id}/reject`, {
    method: "POST",
    credentials: "include",
  });
  await handle(res);
}

export async function listUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/admin/users`, {
    credentials: "include",
  });
  const data = await handle<{ users: User[] }>(res);
  return data.users;
}

export async function banUser(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${id}/ban`, {
    method: "POST",
    credentials: "include",
  });
  await handle(res);
}

export async function unbanUser(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${id}/unban`, {
    method: "POST",
    credentials: "include",
  });
  await handle(res);
}

export async function getMetrics(): Promise<Metrics> {
  const res = await fetch(`${API_BASE}/admin/metrics`, {
    credentials: "include",
  });
  return handle(res);
}

export async function getConfig(): Promise<Config> {
  const res = await fetch(`${API_BASE}/admin/config`, {
    credentials: "include",
  });
  return handle(res);
}

export async function updateConfig(patch: Partial<Config>): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/config`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  await handle(res);
}
