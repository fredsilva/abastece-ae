-- Suporta cooldown de reenvio no /auth/email/request sem precisar derivar a
-- data de criação a partir de expires_at.
ALTER TABLE magic_links ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
