import { Hono } from "hono";
import { requireUser } from "../middleware/requireUser";

const PLATFORMS = ["ios", "android"];

export const pushTokens = new Hono<{ Bindings: Env; Variables: { userId: string; userEmail: string } }>();

pushTokens.post("/", requireUser, async (c) => {
  const body = await c.req.json<{ expoPushToken?: string; platform?: string }>();
  const { expoPushToken, platform } = body;

  if (!expoPushToken || !platform || !PLATFORMS.includes(platform)) {
    return c.json({ error: "campos obrigatórios: expoPushToken, platform (ios ou android)" }, 400);
  }

  const userId = c.get("userId");

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO push_tokens (id, user_id, expo_push_token, platform, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(crypto.randomUUID(), userId, expoPushToken, platform, new Date().toISOString())
    .run();

  return c.json({ ok: true });
});
