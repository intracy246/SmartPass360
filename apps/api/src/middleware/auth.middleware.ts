import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export type AuthScope = "OWNER" | "BUILDING";

export type AuthUser = {
  scope: AuthScope;
  siteId?: string;
  username: string;
  mustChangePassword?: boolean;
};

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signAuthToken(user: AuthUser) {
  const payload = encode(JSON.stringify({
    ...user,
    exp: Date.now() + 12 * 60 * 60 * 1000
  }));
  const signature = crypto
    .createHmac("sha256", env.AUTH_JWT_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function readAuthUser(request: Request): AuthUser | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7);
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = crypto
    .createHmac("sha256", env.AUTH_JWT_SECRET)
    .update(payload)
    .digest("base64url");

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(decode(payload)) as AuthUser & { exp: number };
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    const { exp: _exp, ...user } = parsed;
    return user;
  } catch {
    return null;
  }
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const user = readAuthUser(request);
  if (!user) {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
    return;
  }
  response.locals.authUser = user;
  next();
}

export function requireOwner(request: Request, response: Response, next: NextFunction) {
  const user = readAuthUser(request);
  if (!user || user.scope !== "OWNER") {
    response.status(403).json({ error: { code: "FORBIDDEN", message: "Owner access required." } });
    return;
  }
  response.locals.authUser = user;
  next();
}

export function requireBuilding(request: Request, response: Response, next: NextFunction) {
  const user = readAuthUser(request);
  if (!user || user.scope !== "BUILDING" || !user.siteId) {
    response.status(403).json({ error: { code: "FORBIDDEN", message: "Building access required." } });
    return;
  }
  response.locals.authUser = user;
  next();
}
