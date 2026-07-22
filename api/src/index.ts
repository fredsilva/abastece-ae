import { Hono } from "hono";
import { cors } from "hono/cors";
import { admin } from "./routes/admin";
import { cfAccess } from "./middleware/cfAccess";

const ADMIN_ORIGINS = ["http://localhost:5173", "https://abastece-ae-admin.pages.dev"];

const app = new Hono<{ Bindings: Env }>();

app.use(
  "/admin/*",
  cors({
    origin: ADMIN_ORIGINS,
    credentials: true,
  })
);
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
