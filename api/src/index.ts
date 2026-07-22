import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", async (c) => {
  const dbCheck = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();

  return c.json({
    status: "ok",
    db: dbCheck?.ok === 1 ? "connected" : "unreachable",
    timestamp: new Date().toISOString(),
  });
});

export default app;
