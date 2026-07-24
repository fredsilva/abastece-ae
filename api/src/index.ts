import { Hono } from "hono";
import { cors } from "hono/cors";
import { admin } from "./routes/admin";
import { auth } from "./routes/auth";
import { stations } from "./routes/stations";
import { priceReports } from "./routes/priceReports";
import { fillUps } from "./routes/fillUps";
import { ratings } from "./routes/ratings";
import { favorites } from "./routes/favorites";
import { pushTokens } from "./routes/pushTokens";
import { cfAccess } from "./middleware/cfAccess";
import { cleanupExpiredSessions, decayConfidenceScores, recomputeAllRatingSummaries } from "./lib/cronJobs";

// Painel admin e API ficam no mesmo domínio (Worker serve o build do admin como static
// assets — ver wrangler.jsonc), então não há requisições cross-origin a proteger com CORS.
// Exceção é o dev local, onde o proxy do Vite (vite.config.ts) já torna as chamadas
// same-origin do ponto de vista do navegador.
const app = new Hono<{ Bindings: Env }>();

// /auth/* é chamado pelo app mobile (React Native, sem CORS) e potencialmente pelo target
// web do Expo — sem cookies/sessão de navegador envolvidos (tudo é bearer token), então CORS
// aberto aqui não amplia superfície de ataque.
app.use("/auth/*", cors({ origin: "*" }));
app.use("/stations/*", cors({ origin: "*" }));
app.use("/price-reports/*", cors({ origin: "*" }));
app.use("/fill-ups/*", cors({ origin: "*" }));
app.use("/ratings/*", cors({ origin: "*" }));
app.use("/favorites/*", cors({ origin: "*" }));
app.use("/push-tokens/*", cors({ origin: "*" }));

app.use("/admin/*", cfAccess);
app.route("/admin", admin);
app.route("/auth", auth);
app.route("/stations", stations);
app.route("/price-reports", priceReports);
app.route("/fill-ups", fillUps);
app.route("/ratings", ratings);
app.route("/favorites", favorites);
app.route("/push-tokens", pushTokens);

app.get("/health", async (c) => {
  const dbCheck = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();

  return c.json({
    status: "ok",
    db: dbCheck?.ok === 1 ? "connected" : "unreachable",
    timestamp: new Date().toISOString(),
  });
});

// Cron Triggers (ver wrangler.jsonc): decaimento diário de confiança + limpeza de sessões
// expiradas roda toda madrugada; recompute semanal de rating summary (mais custoso, depende
// da média da cidade) roda uma vez por semana. Refresh da ANP (anp_reference_prices) fica de
// fora dos crons de propósito — a fonte exige download manual do CSV mais recente a cada mês
// (nomeação inconsistente, sem URL estável) e QA amostral, então continua um passo manual via
// scripts/seed-anp.ts (ver PLANO-MVP.md).
const DAILY_CRON = "0 6 * * *";
const WEEKLY_CRON = "0 7 * * 1";

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    if (controller.cron === DAILY_CRON) {
      ctx.waitUntil(Promise.all([decayConfidenceScores(env.DB), cleanupExpiredSessions(env.DB)]));
    } else if (controller.cron === WEEKLY_CRON) {
      ctx.waitUntil(recomputeAllRatingSummaries(env.DB));
    }
  },
} satisfies ExportedHandler<Env>;
