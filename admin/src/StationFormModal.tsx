import { useEffect, useRef, useState } from "react";
import type { FuelType, PriceHistoryEntry, Station, StationInput, StationPricesInput } from "./types";
import { StationMap } from "./StationMap";
import { Combobox, type ComboboxOption } from "./Combobox";
import { BR_STATE_OPTIONS } from "./br-states";
import { getStationPriceHistory } from "./api";
import { FUEL_COLORS } from "./fuelColors";
import { PriceHistoryChart } from "./PriceHistoryChart";

interface IbgeMunicipio {
  nome: string;
}

interface Props {
  cityId: string;
  defaultCity: string;
  defaultState: string;
  station?: Station;
  onClose: () => void;
  onSave: (input: StationInput, prices: StationPricesInput) => Promise<void>;
}

const FUEL_LABELS: Record<FuelType, string> = {
  gasolina: "Gasolina",
  etanol: "Etanol",
  diesel: "Diesel",
};

type HistoryTab = "table" | "chart";

function IconTable() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="9" y1="10" x2="9" y2="20" />
    </svg>
  );
}

function IconChartLine() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </svg>
  );
}

function renderPriceDelta(entry: PriceHistoryEntry) {
  if (entry.previousPrice === null) {
    return <span className="price-delta price-delta--flat">Novo</span>;
  }
  const diff = entry.price - entry.previousPrice;
  if (Math.abs(diff) < 0.001) {
    return <span className="price-delta price-delta--flat">—</span>;
  }
  const isUp = diff > 0;
  return (
    <span className={`price-delta ${isUp ? "price-delta--up" : "price-delta--down"}`}>
      {isUp ? "▲" : "▼"} R$ {Math.abs(diff).toFixed(2)}
    </span>
  );
}

export function StationFormModal({ cityId, defaultCity, defaultState, station, onClose, onSave }: Props) {
  const [form, setForm] = useState<StationInput>({
    nomeFantasia: station?.nomeFantasia ?? "",
    razaoSocial: station?.razaoSocial ?? "",
    cnpj: station?.cnpj ?? "",
    brand: station?.brand ?? "",
    addressStreet: station?.addressStreet ?? "",
    addressNumber: station?.addressNumber ?? "",
    addressNeighborhood: station?.addressNeighborhood ?? "",
    city: station?.city ?? defaultCity,
    state: station?.state ?? defaultState,
    postalCode: station?.postalCode ?? "",
    latitude: station?.latitude ?? 0,
    longitude: station?.longitude ?? 0,
    cityId: station?.cityId ?? cityId,
  });
  const [prices, setPrices] = useState<Record<FuelType, string>>({
    gasolina: station?.prices.gasolina ? String(station.prices.gasolina.price) : "",
    etanol: station?.prices.etanol ? String(station.prices.etanol.price) : "",
    diesel: station?.prices.diesel ? String(station.prices.diesel.price) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<HistoryTab>("table");
  const [cityOptions, setCityOptions] = useState<ComboboxOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citiesError, setCitiesError] = useState(false);
  const citiesCache = useRef<Map<string, ComboboxOption[]>>(new Map());

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!station) return;
    let cancelled = false;
    setHistoryLoading(true);
    getStationPriceHistory(station.id)
      .then((entries) => {
        if (!cancelled) setHistory(entries);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [station]);

  useEffect(() => {
    const uf = form.state;
    if (!uf) {
      setCityOptions([]);
      return;
    }
    const cached = citiesCache.current.get(uf);
    if (cached) {
      setCityOptions(cached);
      setCitiesError(false);
      return;
    }

    let cancelled = false;
    setCitiesLoading(true);
    setCitiesError(false);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar cidades");
        return res.json() as Promise<IbgeMunicipio[]>;
      })
      .then((data) => {
        if (cancelled) return;
        const options = data.map((c) => ({ value: c.nome, label: c.nome }));
        citiesCache.current.set(uf, options);
        setCityOptions(options);
      })
      .catch(() => {
        if (!cancelled) {
          setCityOptions([]);
          setCitiesError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.state]);

  function set<K extends keyof StationInput>(key: K, value: StationInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleStateChange(sigla: string) {
    setForm((f) => (f.state === sigla ? f : { ...f, state: sigla, city: "" }));
  }

  function setPrice(fuel: FuelType, value: string) {
    setPrices((p) => ({ ...p, [fuel]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.state || !form.city) {
      setError("Selecione o estado e a cidade.");
      return;
    }

    const pricesPayload: StationPricesInput = {};
    for (const fuel of Object.keys(prices) as FuelType[]) {
      const raw = prices[fuel].trim().replace(",", ".");
      if (raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) {
        setError(`Preço inválido para ${FUEL_LABELS[fuel]}.`);
        return;
      }
      pricesPayload[fuel] = value;
    }

    setSaving(true);
    try {
      await onSave(form, pricesPayload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal--lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{station ? "Editar posto" : "Novo posto"}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 3.5l-9 9M3.5 3.5l9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-banner">{error}</div>}

          <form id="station-form" onSubmit={handleSubmit}>
            <div className="form-section-title">Identificação</div>

            <div className="form-row">
              <div className="form-field" style={{ flex: 2 }}>
                <label>Nome fantasia *</label>
                <input className="text-input" required value={form.nomeFantasia} onChange={(e) => set("nomeFantasia", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Bandeira</label>
                <input className="text-input" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field" style={{ flex: 2 }}>
                <label>Razão social</label>
                <input className="text-input" value={form.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} />
              </div>
              <div className="form-field">
                <label>CNPJ</label>
                <input className="text-input" value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
              </div>
            </div>

            <div className="form-section-title">Endereço</div>

            <div className="form-row">
              <div className="form-field" style={{ flex: 2 }}>
                <label>Rua</label>
                <input className="text-input" value={form.addressStreet} onChange={(e) => set("addressStreet", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Número</label>
                <input className="text-input" value={form.addressNumber} onChange={(e) => set("addressNumber", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Bairro</label>
                <input className="text-input" value={form.addressNeighborhood} onChange={(e) => set("addressNeighborhood", e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field" style={{ flex: 1.3 }}>
                <label>Estado *</label>
                <Combobox value={form.state} onChange={handleStateChange} options={BR_STATE_OPTIONS} placeholder="Buscar estado..." />
              </div>
              <div className="form-field" style={{ flex: 1.3 }}>
                <label>Cidade *</label>
                <Combobox
                  value={form.city}
                  onChange={(v) => set("city", v)}
                  options={cityOptions}
                  loading={citiesLoading}
                  disabled={!form.state}
                  placeholder={form.state ? "Buscar cidade..." : "Selecione o estado primeiro"}
                  emptyMessage={citiesError ? "Erro ao carregar cidades" : "Nenhuma cidade encontrada"}
                />
              </div>
              <div className="form-field">
                <label>CEP</label>
                <input className="text-input" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
              </div>
            </div>

            <div className="form-section-title">Localização</div>

            <div className="form-row">
              <div className="form-field">
                <label>Latitude *</label>
                <input
                  className="text-input"
                  required
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => set("latitude", parseFloat(e.target.value))}
                />
              </div>
              <div className="form-field">
                <label>Longitude *</label>
                <input
                  className="text-input"
                  required
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => set("longitude", parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="form-field">
              <StationMap latitude={form.latitude} longitude={form.longitude} />
            </div>

            <div className="form-section-title">Preços</div>

            <div className="form-row">
              {(Object.keys(FUEL_LABELS) as FuelType[]).map((fuel) => (
                <div className="form-field" key={fuel}>
                  <label>{FUEL_LABELS[fuel]} (R$/L)</label>
                  <input
                    className="text-input"
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="0,00"
                    value={prices[fuel]}
                    onChange={(e) => setPrice(fuel, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </form>

          {station && (
            <div>
              <div className="form-section-title">Histórico de preços</div>

              <div className="tabs">
                <button
                  type="button"
                  className={`tab-button${historyTab === "table" ? " tab-button--active" : ""}`}
                  onClick={() => setHistoryTab("table")}
                >
                  <IconTable />
                  Tabela
                </button>
                <button
                  type="button"
                  className={`tab-button${historyTab === "chart" ? " tab-button--active" : ""}`}
                  onClick={() => setHistoryTab("chart")}
                >
                  <IconChartLine />
                  Gráfico
                </button>
              </div>

              {historyLoading ? (
                <p style={{ color: "var(--color-muted)", fontSize: 14 }}>Carregando histórico...</p>
              ) : historyTab === "table" ? (
                history.length === 0 ? (
                  <p style={{ color: "var(--color-muted)", fontSize: 14 }}>Nenhuma alteração de preço registrada ainda.</p>
                ) : (
                  <div style={{ maxHeight: 280, overflowY: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Combustível</th>
                          <th>Anterior</th>
                          <th>Novo preço</th>
                          <th>Variação</th>
                          <th>Origem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((entry) => (
                          <tr key={entry.id}>
                            <td>{new Date(entry.changedAt).toLocaleString("pt-BR")}</td>
                            <td>
                              <span className="fuel-cell">
                                <span className="fuel-cell-dot" style={{ background: FUEL_COLORS[entry.fuelType] }} />
                                {FUEL_LABELS[entry.fuelType]}
                              </span>
                            </td>
                            <td className="num">{entry.previousPrice !== null ? `R$ ${entry.previousPrice.toFixed(2)}` : "—"}</td>
                            <td className="num">R$ {entry.price.toFixed(2)}</td>
                            <td>{renderPriceDelta(entry)}</td>
                            <td style={{ color: "var(--color-muted-soft)", fontSize: 13 }}>
                              {entry.source === "admin"
                                ? entry.changedBy
                                  ? `Admin (${entry.changedBy})`
                                  : "Admin"
                                : "Usuário do app"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <PriceHistoryChart history={history} />
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="station-form" className="button-primary" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
