import type { MiddlewareHandler } from "hono";
import { verifyAccessToken } from "../lib/jwt";

export const requireUser: MiddlewareHandler<{ Bindings: Env; Variables: { userId: string; userEmail: string } }> = async (
  c,
  next
) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return c.json({ error: "não autenticado" }, 401);
  }

  try {
    const payload = await verifyAccessToken(c.env.JWT_SECRET, token);
    c.set("userId", payload.sub as string);
    c.set("userEmail", payload.email as string);
  } catch {
    return c.json({ error: "token inválido" }, 401);
  }

  await next();
};
