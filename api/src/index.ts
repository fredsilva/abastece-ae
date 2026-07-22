import { Hono } from "hono";
import { admin } from "./routes/admin";
import { cfAccess } from "./middleware/cfAccess";

// Painel admin e API ficam no mesmo domínio (Worker serve o build do admin como static
// assets — ver wrangler.jsonc), então não há requisições cross-origin a proteger com CORS.
// Exceção é o dev local, onde o proxy do Vite (vite.config.ts) já torna as chamadas
// same-origin do ponto de vista do navegador.
const app = new Hono<{ Bindings: Env }>();

app.use("/admin/*", cfAccess);
app.route("/admin", admin);

app.get("/health", async (c) => {
  const dbCheck = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();

  return c.json({
    status: "ok",
    db: dbCheck?.ok === 1 ? "connected" : "unreachable",
    timestamp: new Date().toISOString(),
  });
});

export default app;
