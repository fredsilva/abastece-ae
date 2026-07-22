import { useState } from "react";
import type { Station, StationInput } from "./types";

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
        <h2 style={{ marginBottom: "var(--space-md)" }}>{station ? "Editar posto" : "Novo posto"}</h2>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Nome fantasia *</label>
            <input className="text-input" required value={form.nomeFantasia} onChange={(e) => set("nomeFantasia", e.target.value)} />
          </div>

          <div className="form-field">
            <label>Razão social</label>
            <input className="text-input" value={form.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>CNPJ</label>
              <input className="text-input" value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Bandeira</label>
              <input className="text-input" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field" style={{ flex: 2 }}>
              <label>Rua</label>
              <input className="text-input" value={form.addressStreet} onChange={(e) => set("addressStreet", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Número</label>
              <input className="text-input" value={form.addressNumber} onChange={(e) => set("addressNumber", e.target.value)} />
            </div>
          </div>

          <div className="form-field">
            <label>Bairro</label>
            <input className="text-input" value={form.addressNeighborhood} onChange={(e) => set("addressNeighborhood", e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-field">
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

          <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-md)", justifyContent: "flex-end" }}>
            <button type="button" className="button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
