import { SignJWT, jwtVerify } from "jose";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export async function signAccessToken(secret: string, payload: AccessTokenPayload): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ email: payload.email })
    .setSubject(payload.sub)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyAccessToken(secret: string, token: string): Promise<AccessTokenPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("token payload inválido");
  }
  return { sub: payload.sub, email: payload.email };
}
