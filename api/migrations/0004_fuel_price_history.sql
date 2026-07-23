-- Histórico de preços — cada mudança de preço (admin ou, futuramente, report do app) gera uma
-- linha aqui. fuel_prices continua guardando só o estado atual (para as queries de listagem/
-- ranking, que são mais frequentes); fuel_price_history é a fonte para gráficos/métricas de
-- variação de preço ao longo do tempo.

CREATE TABLE fuel_price_history (
  id TEXT PRIMARY KEY,
  gas_station_id TEXT NOT NULL REFERENCES gas_stations(id),
  fuel_type TEXT NOT NULL CHECK(fuel_type IN ('gasolina','etanol','diesel')),
  price REAL NOT NULL,
  previous_price REAL,
  source TEXT NOT NULL CHECK(source IN ('admin','user_report')),
  changed_by TEXT,
  price_report_id TEXT REFERENCES price_reports(id),
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_price_history_station_fuel_time ON fuel_price_history(gas_station_id, fuel_type, changed_at DESC);
