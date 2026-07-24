import { useEffect, useState } from "react";
import { approvePriceReport, listPriceReports, rejectPriceReport } from "./api";
import type { PriceReport } from "./types";

function formatDistance(m: number | null) {
  if (m === null) return "—";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export function ModerationPage() {
  const [reports, setReports] = useState<PriceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listPriceReports("pending_review");
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar a fila de moderação");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    setProcessingId(id);
    try {
      await approvePriceReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aprovar report");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id: string) {
    setProcessingId(id);
    try {
      await rejectPriceReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao rejeitar report");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h2>Moderação de preços</h2>
        <p style={{ color: "var(--color-muted)", margin: 0, fontSize: 14 }}>
          Reports que fugiram da faixa esperada de preço da cidade — precisam de aprovação manual antes de valerem
          na lista do app.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="feature-card">
        {loading ? (
          <p>Carregando...</p>
        ) : reports.length === 0 ? (
          <p style={{ color: "var(--color-muted)" }}>Nenhum report pendente de revisão. 🎉</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Posto</th>
                <th>Combustível</th>
                <th>Preço reportado</th>
                <th>Desconto</th>
                <th>Distância no momento</th>
                <th>Reportado por</th>
                <th>Quando</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.stationName}</td>
                  <td style={{ textTransform: "capitalize" }}>{r.fuelType}</td>
                  <td style={{ fontWeight: 600 }}>R$ {r.price.toFixed(2)}</td>
                  <td>
                    {r.pixDiscount && <span className="badge-pill badge-pill--active">Pix</span>}{" "}
                    {r.cashDiscount && <span className="badge-pill badge-pill--active">Dinheiro</span>}
                    {!r.pixDiscount && !r.cashDiscount && "—"}
                  </td>
                  <td>{formatDistance(r.distanceFromStationM)}</td>
                  <td style={{ color: "var(--color-muted-soft)", fontSize: 13 }}>{r.reporterEmail}</td>
                  <td style={{ color: "var(--color-muted-soft)", fontSize: 13 }}>{formatDate(r.createdAt)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="button-primary"
                      style={{ height: 32, padding: "6px 12px", marginRight: "var(--space-xxs)" }}
                      disabled={processingId === r.id}
                      onClick={() => handleApprove(r.id)}
                    >
                      Aprovar
                    </button>
                    <button
                      className="button-secondary"
                      style={{ height: 32, padding: "6px 12px" }}
                      disabled={processingId === r.id}
                      onClick={() => handleReject(r.id)}
                    >
                      Rejeitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
