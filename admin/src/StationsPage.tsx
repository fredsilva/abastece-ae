import { useEffect, useMemo, useState } from "react";
import {
  bulkDeleteStations,
  bulkUpdateStationStatus,
  createStation,
  deleteStation,
  listStations,
  updateStation,
  updateStationPrices,
} from "./api";
import { StationFormModal } from "./StationFormModal";
import { StationImportModal } from "./StationImportModal";
import { StationPriceModal } from "./StationPriceModal";
import type { Station, StationInput, StationPricesInput } from "./types";

const PILOT_CITY_ID = "paraiso-do-tocantins-to";
const PILOT_CITY = "Paraíso do Tocantins";
const PILOT_STATE = "TO";

function formatPrice(station: Station, fuel: "gasolina" | "etanol" | "diesel") {
  const p = station.prices[fuel];
  if (!p) return "—";
  const label = `R$ ${p.price.toFixed(2)}`;
  return p.confidenceScore === 0 ? `${label} (estimado)` : label;
}

function statusBadgeClass(status: Station["status"]) {
  if (status === "active") return "badge-pill badge-pill--active";
  if (status === "inactive") return "badge-pill badge-pill--inactive";
  return "badge-pill badge-pill--pending";
}

function statusLabel(status: Station["status"]) {
  if (status === "active") return "Ativo";
  if (status === "inactive") return "Inativo";
  return "Em revisão";
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function matchesSearch(station: Station, query: string): boolean {
  const needle = normalize(query);
  const haystack = [station.nomeFantasia, station.brand, station.city, station.cnpj, station.addressStreet, station.addressNeighborhood]
    .filter((v): v is string => !!v)
    .map(normalize)
    .join(" ");
  return haystack.includes(needle);
}

export function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Station | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  const [priceEditing, setPriceEditing] = useState<Station | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listStations(PILOT_CITY_ID);
      setStations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar postos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return stations;
    return stations.filter((s) => matchesSearch(s, search));
  }, [stations, search]);

  useEffect(() => {
    const visibleIds = new Set(filtered.map((s) => s.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  async function handleSave(input: StationInput, prices: StationPricesInput) {
    const id = editing ? editing.id : (await createStation(input)).id;
    if (editing) {
      await updateStation(editing.id, input);
    }
    if (Object.keys(prices).length > 0) {
      await updateStationPrices(id, prices);
    }
    await load();
  }

  async function handleSavePrices(prices: StationPricesInput) {
    if (!priceEditing) return;
    await updateStationPrices(priceEditing.id, prices);
    await load();
  }

  async function handleToggleStatus(station: Station) {
    const nextStatus = station.status === "active" ? "inactive" : "active";
    await updateStation(station.id, { status: nextStatus });
    await load();
  }

  async function handleDelete(station: Station) {
    if (!window.confirm(`Excluir permanentemente o posto "${station.nomeFantasia}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteStation(station.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir posto");
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((s) => s.id))));
  }

  async function handleBulkInactivate() {
    setBulkBusy(true);
    setError(null);
    try {
      await bulkUpdateStationStatus([...selected], "inactive");
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao inativar postos selecionados");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Excluir permanentemente ${selected.size} posto(s) selecionado(s)? Essa ação não pode ser desfeita.`)) return;
    setBulkBusy(true);
    setError(null);
    try {
      await bulkDeleteStations([...selected]);
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir postos selecionados");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
        <div>
          <h2>Postos — {PILOT_CITY}/{PILOT_STATE}</h2>
          <p style={{ color: "var(--color-muted)", margin: 0, fontSize: 14 }}>{stations.length} posto(s) cadastrado(s)</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <button className="button-secondary" onClick={() => setImportOpen(true)}>
            Importar JSON
          </button>
          <button
            className="button-primary"
            onClick={() => {
              setEditing(undefined);
              setModalOpen(true);
            }}
          >
            + Novo posto
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ marginBottom: "var(--space-md)", display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
        <input
          className="text-input"
          style={{ maxWidth: 360 }}
          placeholder="Buscar por nome, bandeira, endereço ou CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {selected.size > 0 && (
          <div className="selection-toolbar">
            <span>{selected.size} selecionado(s)</span>
            <button className="button-secondary" style={{ height: 32, padding: "6px 12px" }} disabled={bulkBusy} onClick={handleBulkInactivate}>
              Inativar selecionados
            </button>
            <button className="button-danger" style={{ height: 32, padding: "6px 12px" }} disabled={bulkBusy} onClick={handleBulkDelete}>
              Excluir selecionados
            </button>
          </div>
        )}
      </div>

      <div className="feature-card">
        {loading ? (
          <p>Carregando...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: "var(--color-muted)" }}>Nenhum posto encontrado para essa busca.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === filtered.length}
                    onChange={toggleSelectAll}
                    aria-label="Selecionar todos"
                  />
                </th>
                <th>Nome</th>
                <th>Bandeira</th>
                <th>Gasolina</th>
                <th>Etanol</th>
                <th>Diesel</th>
                <th>Status</th>
                <th>Origem</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleSelected(s.id)}
                      aria-label={`Selecionar ${s.nomeFantasia}`}
                    />
                  </td>
                  <td>{s.nomeFantasia}</td>
                  <td>{s.brand ?? "—"}</td>
                  <td>{formatPrice(s, "gasolina")}</td>
                  <td>{formatPrice(s, "etanol")}</td>
                  <td>{formatPrice(s, "diesel")}</td>
                  <td>
                    <span className={statusBadgeClass(s.status)}>{statusLabel(s.status)}</span>
                  </td>
                  <td style={{ color: "var(--color-muted-soft)", fontSize: 13 }}>
                    {s.source === "anp_seed" ? "ANP" : s.source === "admin" ? "Admin" : "Usuário"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="button-secondary"
                      style={{ height: 32, padding: "6px 12px", marginRight: "var(--space-xxs)" }}
                      onClick={() => setPriceEditing(s)}
                    >
                      Ajustar preço
                    </button>
                    <button
                      className="button-secondary"
                      style={{ height: 32, padding: "6px 12px", marginRight: "var(--space-xxs)" }}
                      onClick={() => {
                        setEditing(s);
                        setModalOpen(true);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="button-secondary"
                      style={{ height: 32, padding: "6px 12px", marginRight: "var(--space-xxs)" }}
                      onClick={() => handleToggleStatus(s)}
                    >
                      {s.status === "active" ? "Desativar" : "Reativar"}
                    </button>
                    <button className="button-danger" style={{ height: 32, padding: "6px 12px" }} onClick={() => handleDelete(s)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <StationFormModal
          cityId={PILOT_CITY_ID}
          defaultCity={PILOT_CITY}
          defaultState={PILOT_STATE}
          station={editing}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {priceEditing && (
        <StationPriceModal station={priceEditing} onClose={() => setPriceEditing(undefined)} onSave={handleSavePrices} />
      )}

      {importOpen && <StationImportModal onClose={() => setImportOpen(false)} onImported={load} />}
    </div>
  );
}
