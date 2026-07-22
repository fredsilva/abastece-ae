-- Suporta importação em lote de postos (ver rota /admin/stations/bulk-import):
-- google_place_id permite detectar duplicatas em reimportações do mesmo levantamento.
ALTER TABLE gas_stations ADD COLUMN google_place_id TEXT;
CREATE UNIQUE INDEX idx_stations_google_place_id ON gas_stations(google_place_id) WHERE google_place_id IS NOT NULL;
