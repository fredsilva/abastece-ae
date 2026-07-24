import { useEffect, useState } from "react";
import { getConfig, updateConfig } from "../api";
import type { RankingWeights, PriceBounds } from "../types";

export function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [weights, setWeights] = useState<RankingWeights>({ price: 0.5, distance: 0.3, rating: 0.2 });
  const [bounds, setBounds] = useState<PriceBounds>({ min: 1, max: 15 });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setError(null);
    try {
      const data = await getConfig();
      setWeights(data.rankingWeights);
      setBounds(data.priceBounds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar configuração");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const sum = weights.price + weights.distance + weights.rating;
      if (Math.abs(sum - 1) > 0.001) {
        throw new Error("A soma dos pesos deve ser 1.0");
      }
      if (bounds.min >= bounds.max) {
        throw new Error("Preço mínimo deve ser menor que o máximo");
      }

      await updateConfig({
        rankingWeights: weights,
        priceBounds: bounds,
      });
      alert("Configuração salva com sucesso!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>Carregando...</div>;

  return (
    <div style={{ padding: "20px", maxWidth: "600px" }}>
      <h1>Configuração</h1>
      {error && <div style={{ color: "red", marginBottom: "16px" }}>{error}</div>}

      <div style={{ marginBottom: "32px" }}>
        <h2>Pesos de Ranking</h2>
        <p style={{ fontSize: "12px", color: "#6b7280" }}>A soma deve ser igual a 1.0</p>

        <div style={{ display: "grid", gap: "12px" }}>
          <div>
            <label>Preço ({weights.price.toFixed(2)})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={weights.price}
              onChange={(e) => setWeights((prev) => ({ ...prev, price: Number(e.target.value) }))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label>Distância ({weights.distance.toFixed(2)})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={weights.distance}
              onChange={(e) => setWeights((prev) => ({ ...prev, distance: Number(e.target.value) }))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label>Avaliação ({weights.rating.toFixed(2)})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={weights.rating}
              onChange={(e) => setWeights((prev) => ({ ...prev, rating: Number(e.target.value) }))}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div style={{ marginTop: "12px", fontSize: "12px", color: weights.price + weights.distance + weights.rating === 1 ? "#10b981" : "#ef4444" }}>
          Soma: {(weights.price + weights.distance + weights.rating).toFixed(2)}
        </div>
      </div>

      <div style={{ marginBottom: "32px" }}>
        <h2>Faixa de Preço Aceita</h2>

        <div style={{ display: "grid", gap: "12px" }}>
          <div>
            <label>Mínimo (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={bounds.min}
              onChange={(e) => setBounds((prev) => ({ ...prev, min: Number(e.target.value) }))}
              style={{ width: "100%", padding: "8px", border: "1px solid #e5e7eb", borderRadius: "4px" }}
            />
          </div>

          <div>
            <label>Máximo (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={bounds.max}
              onChange={(e) => setBounds((prev) => ({ ...prev, max: Number(e.target.value) }))}
              style={{ width: "100%", padding: "8px", border: "1px solid #e5e7eb", borderRadius: "4px" }}
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          backgroundColor: "#000",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: "4px",
          border: "none",
          cursor: "pointer",
          fontWeight: "600",
        }}
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
