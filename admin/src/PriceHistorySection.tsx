import { useEffect, useState } from "react";
import type { FuelType, PriceHistoryEntry } from "./types";
import { getStationPriceHistory } from "./api";
import { FUEL_COLORS } from "./fuelColors";
import { PriceHistoryChart } from "./PriceHistoryChart";

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

interface Props {
  stationId: string;
}

export function PriceHistorySection({ stationId }: Props) {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<HistoryTab>("table");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getStationPriceHistory(stationId)
      .then((entries) => {
        if (!cancelled) setHistory(entries);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stationId]);

  return (
    <div>
      <div className="form-section-title">Histórico de preços</div>

      <div className="tabs">
        <button type="button" className={`tab-button${tab === "table" ? " tab-button--active" : ""}`} onClick={() => setTab("table")}>
          <IconTable />
          Tabela
        </button>
        <button type="button" className={`tab-button${tab === "chart" ? " tab-button--active" : ""}`} onClick={() => setTab("chart")}>
          <IconChartLine />
          Gráfico
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--color-muted)", fontSize: 14 }}>Carregando histórico...</p>
      ) : tab === "table" ? (
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
                      {entry.source === "admin" ? (entry.changedBy ? `Admin (${entry.changedBy})` : "Admin") : "Usuário do app"}
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
  );
}
