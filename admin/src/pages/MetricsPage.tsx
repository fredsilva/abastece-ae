import { useEffect, useState } from "react";
import { getMetrics } from "../api";
import type { Metrics } from "../types";

export function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setError(null);
    try {
      const data = await getMetrics();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Carregando...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!metrics) return <div>Nenhuma métrica disponível</div>;

  const stats = [
    { label: "Postos Cadastrados", value: metrics.stationsCount },
    { label: "Postos Verificados", value: metrics.verifiedStationsCount },
    { label: "Usuários Ativos", value: metrics.usersCount },
    { label: "Usuários Ativos (7d)", value: metrics.activeUsersCount },
    { label: "Reports de Preço", value: metrics.reportsCount },
    { label: "Abastecimentos Confirmados", value: metrics.fillUpsCount },
  ];

  return (
    <div style={{ padding: "20px" }}>
      <h1>Métricas</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "16px",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>{stat.value}</div>
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>{stat.label}</div>
          </div>
        ))}
      </div>
      <button onClick={load} style={{ marginTop: "20px" }}>
        Atualizar
      </button>
    </div>
  );
}
