import crypto from "node:crypto";
import { promisify } from "node:util";
import { Router } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { requireBuilding, requireOwner, signAuthToken, type AuthUser } from "../middleware/auth.middleware";

export const ownerRouter = Router();

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(keyHex, "hex");
  return storedKey.length === derivedKey.length && crypto.timingSafeEqual(storedKey, derivedKey);
}

const loginSchema = z.object({
  username: z.string().trim().min(3).max(120),
  password: z.string().min(8).max(200)
});

const provisionBuildingSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(40),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  adminUsername: z.string().trim().min(3).max(120),
  temporaryPassword: z.string().min(8).max(200)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(200),
  newPassword: z.string().min(8).max(200)
});

ownerRouter.post("/login", async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid login data.", details: parsed.error.flatten() }
    });
  }

  const { username, password } = parsed.data;

  if (username === env.OWNER_USERNAME && password === env.OWNER_PASSWORD) {
    const user: AuthUser = { scope: "OWNER", username };
    return response.status(200).json({
      success: true,
      data: { token: signAuthToken(user), user }
    });
  }

  const site = await prisma.site.findUnique({ where: { adminUsername: username } });

  if (!site || !site.adminPasswordHash || !site.isActive || site.status === "SUSPENDED") {
    return response.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password." }
    });
  }

  const matches = await verifyPassword(password, site.adminPasswordHash);
  if (!matches) {
    return response.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password." }
    });
  }

  const user: AuthUser = {
    scope: "BUILDING",
    siteId: site.id,
    username,
    mustChangePassword: site.mustChangePassword
  };

  return response.status(200).json({
    success: true,
    data: {
      token: signAuthToken(user),
      user,
      building: {
        id: site.id,
        name: site.name,
        code: site.code,
        status: site.status
      }
    }
  });
});

ownerRouter.get("/buildings", requireOwner, async (_request, response, next) => {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        organizations: { where: { isActive: true }, include: { organization: true } },
        kiosks: true
      }
    });

    return response.status(200).json({
      success: true,
      data: sites.map((site) => ({
        ...site,
        adminPasswordHash: undefined,
        organizations: site.organizations.map((item) => item.organization),
        counts: {
          organizations: site.organizations.length,
          kiosks: site.kiosks.length
        }
      }))
    });
  } catch (error) {
    return next(error);
  }
});

ownerRouter.post("/buildings", requireOwner, async (request, response, next) => {
  try {
    const parsed = provisionBuildingSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid building data.", details: parsed.error.flatten() }
      });
    }

    const data = parsed.data;
    const passwordHash = await hashPassword(data.temporaryPassword);

    const site = await prisma.site.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        address: data.address || undefined,
        city: data.city || undefined,
        country: data.country || undefined,
        adminUsername: data.adminUsername,
        adminPasswordHash: passwordHash,
        mustChangePassword: true,
        status: "PENDING",
        isActive: true,
        provisionedAt: new Date()
      }
    });

    return response.status(201).json({
      success: true,
      data: {
        id: site.id,
        name: site.name,
        code: site.code,
        adminUsername: site.adminUsername,
        mustChangePassword: site.mustChangePassword,
        status: site.status
      }
    });
  } catch (error) {
    return next(error);
  }
});

ownerRouter.get("/me/building", requireBuilding, async (_request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const site = await prisma.site.findUnique({
      where: { id: user.siteId! },
      include: {
        organizations: { where: { isActive: true }, include: { organization: true } },
        kiosks: true
      }
    });

    if (!site) {
      return response.status(404).json({ error: { code: "BUILDING_NOT_FOUND", message: "Building not found." } });
    }

    return response.status(200).json({
      success: true,
      data: {
        ...site,
        adminPasswordHash: undefined,
        organizations: site.organizations.map((item) => item.organization)
      }
    });
  } catch (error) {
    return next(error);
  }
});

ownerRouter.post("/me/change-password", requireBuilding, async (request, response, next) => {
  try {
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid password data.", details: parsed.error.flatten() }
      });
    }

    const user = response.locals.authUser as AuthUser;
    const site = await prisma.site.findUnique({ where: { id: user.siteId! } });

    if (!site?.adminPasswordHash) {
      return response.status(404).json({ error: { code: "BUILDING_NOT_FOUND", message: "Building account not found." } });
    }

    const matches = await verifyPassword(parsed.data.currentPassword, site.adminPasswordHash);
    if (!matches) {
      return response.status(400).json({ error: { code: "INVALID_PASSWORD", message: "Current password is incorrect." } });
    }

    const hash = await hashPassword(parsed.data.newPassword);
    const updated = await prisma.site.update({
      where: { id: site.id },
      data: {
        adminPasswordHash: hash,
        mustChangePassword: false,
        status: "ACTIVE",
        activatedAt: site.activatedAt ?? new Date()
      }
    });

    const refreshed: AuthUser = {
      scope: "BUILDING",
      siteId: updated.id,
      username: updated.adminUsername!,
      mustChangePassword: false
    };

    return response.status(200).json({
      success: true,
      data: {
        token: signAuthToken(refreshed),
        user: refreshed
      }
    });
  } catch (error) {
    return next(error);
  }
});
