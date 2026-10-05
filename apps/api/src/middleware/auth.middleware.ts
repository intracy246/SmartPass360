import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export type AuthScope = "OWNER" | "BUILDING";

export type AuthUser = {
  scope: AuthScope;
  siteId?: string;
  username: string;
  mustChangePassword?: boolean;
};

export function signAuthToken(user: AuthUser) {
  return jwt.sign(user, env.AUTH_JWT_SECRET, { expiresIn: "12h" });
}

export function readAuthUser(request: Request): AuthUser | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.slice(7), env.AUTH_JWT_SECRET) as AuthUser;
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
