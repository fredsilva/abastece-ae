import { useEffect, useState } from "react";
import { createStation, listStations, updateStation } from "./api";
import { StationFormModal } from "./StationFormModal";
import type { Station, StationInput } from "./types";

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

export function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Station | undefined>(undefined);

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

  async function handleSave(input: StationInput) {
    if (editing) {
      await updateStation(editing.id, input);
    } else {
      await createStation(input);
    }
    await load();
  }

  async function handleToggleStatus(station: Station) {
    const nextStatus = station.status === "active" ? "inactive" : "active";
    await updateStation(station.id, { status: nextStatus });
    await load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
        <div>
          <h2>Postos — {PILOT_CITY}/{PILOT_STATE}</h2>
          <p style={{ color: "var(--color-muted)", margin: 0, fontSize: 14 }}>{stations.length} posto(s) cadastrado(s)</p>
        </div>
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

      {error && <div className="error-banner">{error}</div>}

      <div className="feature-card">
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
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
              {stations.map((s) => (
                <tr key={s.id}>
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
                      onClick={() => {
                        setEditing(s);
                        setModalOpen(true);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="button-secondary"
                      style={{ height: 32, padding: "6px 12px" }}
                      onClick={() => handleToggleStatus(s)}
                    >
                      {s.status === "active" ? "Desativar" : "Reativar"}
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
    </div>
  );
}
