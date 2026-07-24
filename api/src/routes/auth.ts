import { Hono } from "hono";
import { generateToken, hashToken } from "../lib/crypto";
import { signAccessToken } from "../lib/jwt";
import { sendMagicLinkEmail } from "../lib/email";
import { requireUser } from "../middleware/requireUser";

export const auth = new Hono<{ Bindings: Env; Variables: { userId: string; userEmail: string } }>();

const MAGIC_LINK_TTL_MINUTES = 15;
const REFRESH_TOKEN_TTL_DAYS = 30;
const REQUEST_COOLDOWN_SECONDS = 60;
const FUEL_TABS = ["gasolina", "etanol", "diesel"] as const;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

auth.post("/email/request", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const email = body.email?.trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return c.json({ error: "e-mail inválido" }, 400);
  }

  const cooldownSince = new Date(Date.now() - REQUEST_COOLDOWN_SECONDS * 1000).toISOString();
  const recent = await c.env.DB.prepare("SELECT id FROM magic_links WHERE email = ? AND created_at > ?")
    .bind(email, cooldownSince)
    .first();
  if (recent) {
    return c.json({ error: "aguarde um minuto antes de solicitar outro link" }, 429);
  }

  const rawToken = generateToken(32);
  const tokenHash = await hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_TTL_MINUTES * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    "INSERT INTO magic_links (id, email, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(crypto.randomUUID(), email, tokenHash, expiresAt, now.toISOString())
    .run();

  const link = `abasteceae://auth-callback?token=${rawToken}`;

  if (c.env.RESEND_API_KEY) {
    await sendMagicLinkEmail(c.env.RESEND_API_KEY, email, link);
  } else {
    console.warn(`RESEND_API_KEY não configurado — magic link para ${email}: ${link}`);
  }

  return c.json({ ok: true });
});

auth.post("/email/verify", async (c) => {
  const body = await c.req.json<{ token?: string }>();
  const rawToken = body.token;
  if (!rawToken) {
    return c.json({ error: "token obrigatório" }, 400);
  }

  const tokenHash = await hashToken(rawToken);
  const now = new Date().toISOString();

  const magicLink = await c.env.DB.prepare(
    "SELECT id, email FROM magic_links WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?"
  )
    .bind(tokenHash, now)
    .first<{ id: string; email: string }>();

  if (!magicLink) {
    return c.json({ error: "link inválido ou expirado" }, 400);
  }

  await c.env.DB.prepare("UPDATE magic_links SET used_at = ? WHERE id = ?").bind(now, magicLink.id).run();

  let user = await c.env.DB.prepare("SELECT id, email, default_fuel_tab FROM users WHERE email = ?")
    .bind(magicLink.email)
    .first<{ id: string; email: string; default_fuel_tab: string }>();

  if (!user) {
    const userId = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO users (id, email, email_verified, created_at, last_active_at) VALUES (?, ?, 1, ?, ?)"
    )
      .bind(userId, magicLink.email, now, now)
      .run();
    user = { id: userId, email: magicLink.email, default_fuel_tab: "gasolina" };
  } else {
    await c.env.DB.prepare("UPDATE users SET last_active_at = ?, email_verified = 1 WHERE id = ?")
      .bind(now, user.id)
      .run();
  }

  const existingIdentity = await c.env.DB.prepare(
    "SELECT id FROM auth_identities WHERE provider = 'email' AND provider_subject = ?"
  )
    .bind(user.email)
    .first();
  if (!existingIdentity) {
    await c.env.DB.prepare(
      "INSERT INTO auth_identities (id, user_id, provider, provider_subject, created_at) VALUES (?, ?, 'email', ?, ?)"
    )
      .bind(crypto.randomUUID(), user.id, user.email, now)
      .run();
  }

  const session = await createSession(c.env.DB, user.id);
  const accessToken = await signAccessToken(c.env.JWT_SECRET, { sub: user.id, email: user.email });

  return c.json({
    accessToken,
    refreshToken: session.refreshToken,
    user: { id: user.id, email: user.email, defaultFuelTab: user.default_fuel_tab },
  });
});

auth.post("/refresh", async (c) => {
  const body = await c.req.json<{ refreshToken?: string }>();
  if (!body.refreshToken) {
    return c.json({ error: "refreshToken obrigatório" }, 400);
  }

  const tokenHash = await hashToken(body.refreshToken);
  const now = new Date().toISOString();

  const existingSession = await c.env.DB.prepare(
    "SELECT id, user_id FROM auth_sessions WHERE refresh_token_hash = ? AND revoked_at IS NULL AND expires_at > ?"
  )
    .bind(tokenHash, now)
    .first<{ id: string; user_id: string }>();

  if (!existingSession) {
    return c.json({ error: "sessão inválida ou expirada" }, 401);
  }

  const user = await c.env.DB.prepare("SELECT id, email FROM users WHERE id = ?")
    .bind(existingSession.user_id)
    .first<{ id: string; email: string }>();
  if (!user) {
    return c.json({ error: "usuário não encontrado" }, 401);
  }

  const newRefreshToken = generateToken(32);
  const newRefreshTokenHash = await hashToken(newRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare("UPDATE auth_sessions SET refresh_token_hash = ?, expires_at = ? WHERE id = ?")
    .bind(newRefreshTokenHash, newExpiresAt, existingSession.id)
    .run();

  const accessToken = await signAccessToken(c.env.JWT_SECRET, { sub: user.id, email: user.email });

  return c.json({ accessToken, refreshToken: newRefreshToken });
});

auth.post("/logout", async (c) => {
  const body = await c.req.json<{ refreshToken?: string }>();
  if (body.refreshToken) {
    const tokenHash = await hashToken(body.refreshToken);
    await c.env.DB.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE refresh_token_hash = ?")
      .bind(new Date().toISOString(), tokenHash)
      .run();
  }
  return c.json({ ok: true });
});

auth.get("/me", requireUser, async (c) => {
  const user = await c.env.DB.prepare("SELECT id, email, default_fuel_tab FROM users WHERE id = ?")
    .bind(c.get("userId"))
    .first<{ id: string; email: string; default_fuel_tab: string }>();

  if (!user) {
    return c.json({ error: "usuário não encontrado" }, 404);
  }

  return c.json({ id: user.id, email: user.email, defaultFuelTab: user.default_fuel_tab });
});

auth.put("/me/preferences", requireUser, async (c) => {
  const body = await c.req.json<{ defaultFuelTab?: string }>();
  const defaultFuelTab = body.defaultFuelTab;

  if (!defaultFuelTab || !FUEL_TABS.includes(defaultFuelTab as (typeof FUEL_TABS)[number])) {
    return c.json({ error: "defaultFuelTab deve ser gasolina, etanol ou diesel" }, 400);
  }

  await c.env.DB.prepare("UPDATE users SET default_fuel_tab = ? WHERE id = ?")
    .bind(defaultFuelTab, c.get("userId"))
    .run();

  return c.json({ ok: true, defaultFuelTab });
});

// LGPD — exclusão de conta (Etapa 9). Anonimiza a linha em users (em vez de apagá-la) para
// preservar a integridade referencial de price_reports/fill_ups/ratings, cujo histórico
// agregado outros usuários continuam enxergando (mesmo padrão de "conta excluída" usado por
// apps de crowdsourcing similares). Dados só de uso pessoal (sessões, identidades de login,
// favoritos, push token) são apagados de verdade.
auth.delete("/me", requireUser, async (c) => {
  const userId = c.get("userId");
  const now = new Date().toISOString();

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE users SET email = ?, email_verified = 0, name = NULL, avatar_url = NULL, deleted_at = ? WHERE id = ?`
    ).bind(`deleted-${userId}@abasteceae.invalid`, now, userId),
    c.env.DB.prepare("DELETE FROM auth_identities WHERE user_id = ?").bind(userId),
    c.env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(userId),
    c.env.DB.prepare("DELETE FROM push_tokens WHERE user_id = ?").bind(userId),
    c.env.DB.prepare("DELETE FROM favorites WHERE user_id = ?").bind(userId),
  ]);

  return c.json({ ok: true });
});

async function createSession(db: D1Database, userId: string): Promise<{ refreshToken: string }> {
  const refreshToken = generateToken(32);
  const refreshTokenHash = await hashToken(refreshToken);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare("INSERT INTO auth_sessions (id, user_id, refresh_token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, refreshTokenHash, now, expiresAt)
    .run();

  return { refreshToken };
}
