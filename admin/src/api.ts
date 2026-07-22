import { API_BASE } from "./config";
import type { Station, StationInput } from "./types";

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
