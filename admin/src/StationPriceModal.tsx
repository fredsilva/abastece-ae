import { useState } from "react";
import type { FuelType, Station, StationPricesInput } from "./types";
import { PriceHistorySection } from "./PriceHistorySection";

const FUEL_LABELS: Record<FuelType, string> = {
  gasolina: "Gasolina",
  etanol: "Etanol",
  diesel: "Diesel",
};

interface Props {
  station: Station;
  onClose: () => void;
  onSave: (prices: StationPricesInput) => Promise<void>;
}

export function StationPriceModal({ station, onClose, onSave }: Props) {
  const [prices, setPrices] = useState<Record<FuelType, string>>({
    gasolina: station.prices.gasolina ? String(station.prices.gasolina.price) : "",
    etanol: station.prices.etanol ? String(station.prices.etanol.price) : "",
    diesel: station.prices.diesel ? String(station.prices.diesel.price) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setPrice(fuel: FuelType, value: string) {
    setPrices((p) => ({ ...p, [fuel]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: StationPricesInput = {};
    for (const fuel of Object.keys(prices) as FuelType[]) {
      const raw = prices[fuel].trim().replace(",", ".");
      if (raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) {
        setError(`Preço inválido para ${FUEL_LABELS[fuel]}.`);
        return;
      }
      payload[fuel] = value;
    }

    if (Object.keys(payload).length === 0) {
      setError("Informe ao menos um preço.");
      return;
    }

    setSaving(true);
    try {
      await onSave(payload);
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
          <h2>Ajustar preço — {station.nomeFantasia}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 3.5l-9 9M3.5 3.5l9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-banner">{error}</div>}

          <form id="price-form" onSubmit={handleSubmit}>
            <div className="form-section-title">Novo preço</div>
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

          <PriceHistorySection stationId={station.id} />
        </div>

        <div className="modal-footer">
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="price-form" className="button-primary" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
