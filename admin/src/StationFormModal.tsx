import { useEffect, useState } from "react";
import type { Station, StationInput } from "./types";
import { StationMap } from "./StationMap";

interface Props {
  cityId: string;
  defaultCity: string;
  defaultState: string;
  station?: Station;
  onClose: () => void;
  onSave: (input: StationInput) => Promise<void>;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function set<K extends keyof StationInput>(key: K, value: StationInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
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
              <div className="form-field" style={{ flex: 2 }}>
                <label>Cidade *</label>
                <input className="text-input" required value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div className="form-field">
                <label>UF *</label>
                <input className="text-input" required maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
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
          </form>
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
