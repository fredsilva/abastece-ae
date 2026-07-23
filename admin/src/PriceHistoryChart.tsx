import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FuelType, PriceHistoryEntry } from "./types";
import { FUEL_COLORS } from "./fuelColors";

const FUEL_LABELS: Record<FuelType, string> = {
  gasolina: "Gasolina",
  etanol: "Etanol",
  diesel: "Diesel",
};
const FUEL_TYPES: FuelType[] = ["gasolina", "etanol", "diesel"];

// Se o último ponto real for mais antigo que isso, estende a linha (flat) até agora —
// senão o gráfico parece truncado quando um combustível não muda de preço há tempos.
const EXTEND_TO_NOW_THRESHOLD_MS = 60_000;

interface SeriesPoint {
  timestamp: number;
  price: number;
  synthetic?: boolean;
}

interface ChartRow {
  timestamp: number;
  [key: string]: number | boolean | undefined;
}

function buildSeries(history: PriceHistoryEntry[], fuel: FuelType): SeriesPoint[] {
  const points: SeriesPoint[] = history
    .filter((h) => h.fuelType === fuel)
    .map((h) => ({ timestamp: new Date(h.changedAt).getTime(), price: h.price }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (points.length === 0) return points;

  const last = points[points.length - 1];
  const now = Date.now();
  if (now - last.timestamp > EXTEND_TO_NOW_THRESHOLD_MS) {
    points.push({ timestamp: now, price: last.price, synthetic: true });
  }
  return points;
}

function buildRows(history: PriceHistoryEntry[]): { rows: ChartRow[]; fuelsWithData: FuelType[] } {
  const seriesByFuel = Object.fromEntries(FUEL_TYPES.map((fuel) => [fuel, buildSeries(history, fuel)])) as Record<
    FuelType,
    SeriesPoint[]
  >;
  const fuelsWithData = FUEL_TYPES.filter((fuel) => seriesByFuel[fuel].length > 0);

  const timestamps = Array.from(new Set(fuelsWithData.flatMap((fuel) => seriesByFuel[fuel].map((p) => p.timestamp)))).sort(
    (a, b) => a - b
  );

  const rows: ChartRow[] = timestamps.map((ts) => {
    const row: ChartRow = { timestamp: ts };
    for (const fuel of fuelsWithData) {
      let effective: SeriesPoint | undefined;
      for (const p of seriesByFuel[fuel]) {
        if (p.timestamp <= ts) effective = p;
        else break;
      }
      if (effective) {
        row[fuel] = effective.price;
        row[`${fuel}__changed`] = effective.timestamp === ts && !effective.synthetic;
      }
    }
    return row;
  });

  return { rows, fuelsWithData };
}

function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatDateFull(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(v: number): string {
  return `R$ ${v.toFixed(2)}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: number }) {
  if (!active || !payload || payload.length === 0 || label === undefined) return null;
  const rows = payload.filter((p) => typeof p.value === "number");
  if (rows.length === 0) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-date">{formatDateFull(label)}</div>
      {rows.map((p) => {
        const fuel = p.dataKey as FuelType;
        return (
          <div className="chart-tooltip-row" key={fuel}>
            <span className="chart-tooltip-key" style={{ background: FUEL_COLORS[fuel] }} />
            <span className="chart-tooltip-label">{FUEL_LABELS[fuel]}</span>
            <span className="chart-tooltip-value">{formatPrice(p.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function renderDot(fuel: FuelType) {
  return ({ cx, cy, payload }: { cx?: number; cy?: number; payload?: ChartRow }) => {
    if (!payload || !payload[`${fuel}__changed`] || cx === undefined || cy === undefined) {
      return <g key={`${fuel}-${payload?.timestamp ?? 0}`} />;
    }
    return (
      <circle
        key={`${fuel}-${payload.timestamp}`}
        cx={cx}
        cy={cy}
        r={4}
        fill={FUEL_COLORS[fuel]}
        stroke="var(--color-canvas)"
        strokeWidth={2}
      />
    );
  };
}

interface Props {
  history: PriceHistoryEntry[];
}

export function PriceHistoryChart({ history }: Props) {
  const { rows, fuelsWithData } = useMemo(() => buildRows(history), [history]);

  if (rows.length === 0) {
    return <p style={{ color: "var(--color-muted)", fontSize: 14 }}>Nenhuma alteração de preço registrada ainda.</p>;
  }

  return (
    <div>
      <div className="chart-legend">
        {fuelsWithData.map((fuel) => (
          <span className="chart-legend-item" key={fuel}>
            <span className="chart-legend-key" style={{ background: FUEL_COLORS[fuel] }} />
            {FUEL_LABELS[fuel]}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-hairline-soft)" vertical={false} />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatDateShort}
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--color-hairline)" }}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            width={68}
            tickFormatter={formatPrice}
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            domain={["dataMin - 0.15", "dataMax + 0.15"]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--color-hairline)", strokeWidth: 1 }} />
          {fuelsWithData.map((fuel) => (
            <Line
              key={fuel}
              type="stepAfter"
              dataKey={fuel}
              stroke={FUEL_COLORS[fuel]}
              strokeWidth={2}
              dot={renderDot(fuel)}
              activeDot={{ r: 5, stroke: "var(--color-canvas)", strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
