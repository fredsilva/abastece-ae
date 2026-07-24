-- Etapa 9 — LGPD: suporte a exclusão de conta (direito ao esquecimento).
-- Guarda a data de exclusão em vez de apagar a linha para preservar a integridade
-- referencial do histórico de contribuições (price_reports, ratings, fill_ups) que
-- outros usuários continuam enxergando de forma agregada/anônima.
ALTER TABLE users ADD COLUMN deleted_at TEXT;
