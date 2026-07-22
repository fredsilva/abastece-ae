import { createRemoteJWKSet, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";

// Verifica o header Cf-Access-Jwt-Assertion que o Cloudflare Access injeta em toda
// requisição que passou pela policy de login. Ver PLANO-MVP.md, seção "Autenticação —
// Painel admin". Sem CF_ACCESS_TEAM_DOMAIN configurado (ex: em `wrangler dev` local, onde
// não existe Access na frente), a verificação é pulada — só faz sentido depois de deployado
// atrás do Access.
export const cfAccess: MiddlewareHandler<{ Bindings: Env; Variables: { accessEmail?: string } }> = async (c, next) => {
  const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN;
  const aud = c.env.CF_ACCESS_AUD;

  if (!teamDomain || !aud) {
    console.warn("cfAccess: CF_ACCESS_TEAM_DOMAIN/CF_ACCESS_AUD não configurados — pulando verificação (só aceitável em dev local)");
    await next();
    return;
  }

  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token) {
    return c.json({ error: "missing Cf-Access-Jwt-Assertion header" }, 403);
  }

  try {
    const jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${teamDomain}`,
      audience: aud,
    });
    c.set("accessEmail", payload.email as string);
  } catch (err) {
    console.warn("cfAccess: falha na verificação do token", err);
    return c.json({ error: "invalid Access token" }, 403);
  }

  await next();
};
