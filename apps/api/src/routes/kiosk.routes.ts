import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireBuilding, type AuthUser } from "../middleware/auth.middleware";

export const kioskRouter = Router();

function createActivationCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}

const siteUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  logoUrl: z.string().max(1500000).nullable().optional()
});

const kioskCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(40),
  location: z.string().trim().optional()
});

const kioskUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(40),
  location: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional()
});

const activateSchema = z.object({
  activationCode: z.string().trim().min(6).max(64),
  deviceId: z.string().trim().min(3).max(160)
});

kioskRouter.patch("/sites/:siteId/settings", requireBuilding, async (request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;

    if (request.params.siteId !== user.siteId) {
      return response.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can update only your building."
        }
      });
    }

    const parsed = siteUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid building settings.",
          details: parsed.error.flatten()
        }
      });
    }

    const site = await prisma.site.update({
      where: { id: user.siteId! },
      data: {
        name: parsed.data.name,
        logoUrl: parsed.data.logoUrl ?? null
      }
    });

    return response.status(200).json({
      success: true,
      data: site
    });
  } catch (error) {
    return next(error);
  }
});

kioskRouter.get("/", requireBuilding, async (_request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;

    const kiosks = await prisma.kiosk.findMany({
      where: { siteId: user.siteId! },
      orderBy: { createdAt: "desc" },
      include: { site: true }
    });

    return response.status(200).json({
      success: true,
      data: kiosks
    });
  } catch (error) {
    return next(error);
  }
});

kioskRouter.post("/", requireBuilding, async (request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const parsed = kioskCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid kiosk data.",
          details: parsed.error.flatten()
        }
      });
    }

    const kiosk = await prisma.kiosk.create({
      data: {
        siteId: user.siteId!,
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        location: parsed.data.location || undefined,
        activationCode: createActivationCode()
      },
      include: { site: true }
    });

    return response.status(201).json({
      success: true,
      data: kiosk
    });
  } catch (error) {
    return next(error);
  }
});

kioskRouter.post("/activate", async (request, response, next) => {
  try {
    const parsed = activateSchema.safeParse(request.body);

    if (!parsed.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid kiosk activation data.",
          details: parsed.error.flatten()
        }
      });
    }

    const kiosk = await prisma.kiosk.findUnique({
      where: {
        activationCode: parsed.data.activationCode.toUpperCase()
      },
      include: {
        site: {
          include: {
            organizations: {
              where: { isActive: true },
              include: { organization: true }
            }
          }
        }
      }
    });

    if (!kiosk || !kiosk.isActive || !kiosk.site.isActive || kiosk.site.status !== "ACTIVE") {
      return response.status(404).json({
        error: {
          code: "KIOSK_NOT_AVAILABLE",
          message: "Kiosk activation code is invalid or inactive."
        }
      });
    }

    if (kiosk.deviceId && kiosk.deviceId !== parsed.data.deviceId) {
      return response.status(409).json({
        error: {
          code: "KIOSK_ALREADY_ACTIVATED",
          message: "This kiosk has already been activated on another device."
        }
      });
    }

    const updated = await prisma.kiosk.update({
      where: { id: kiosk.id },
      data: {
        deviceId: parsed.data.deviceId,
        activatedAt: kiosk.activatedAt ?? new Date(),
        lastSeenAt: new Date()
      }
    });

    return response.status(200).json({
      success: true,
      data: {
        kiosk: updated,
        site: kiosk.site,
        organizations: kiosk.site.organizations.map((item) => item.organization)
      }
    });
  } catch (error) {
    return next(error);
  }
});

kioskRouter.patch("/:kioskId", requireBuilding, async (request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const parsed = kioskUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid kiosk data.",
          details: parsed.error.flatten()
        }
      });
    }

    const existing = await prisma.kiosk.findFirst({
      where: { id: request.params.kioskId, siteId: user.siteId! }
    });

    if (!existing) {
      return response.status(404).json({
        error: { code: "KIOSK_NOT_FOUND", message: "Kiosk not found in this building." }
      });
    }

    const updated = await prisma.kiosk.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        location: parsed.data.location ?? null,
        isActive: parsed.data.isActive ?? existing.isActive
      },
      include: { site: true }
    });

    return response.status(200).json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
});

kioskRouter.delete("/:kioskId", requireBuilding, async (request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const existing = await prisma.kiosk.findFirst({
      where: { id: request.params.kioskId, siteId: user.siteId! }
    });

    if (!existing) {
      return response.status(404).json({
        error: { code: "KIOSK_NOT_FOUND", message: "Kiosk not found in this building." }
      });
    }

    await prisma.kiosk.delete({ where: { id: existing.id } });

    return response.status(200).json({
      success: true,
      data: { id: existing.id }
    });
  } catch (error) {
    return next(error);
  }
});

kioskRouter.get("/:kioskId/config", async (request, response, next) => {
  try {
    const deviceId =
      typeof request.headers["x-kiosk-device-id"] === "string"
        ? request.headers["x-kiosk-device-id"]
        : undefined;

    if (!deviceId) {
      return response.status(401).json({
        error: {
          code: "KIOSK_DEVICE_REQUIRED",
          message: "Kiosk device identity is required."
        }
      });
    }

    const kiosk = await prisma.kiosk.findUnique({
      where: { id: request.params.kioskId },
      include: {
        site: {
          include: {
            organizations: {
              where: { isActive: true },
              include: { organization: true }
            }
          }
        }
      }
    });

    if (
      !kiosk ||
      !kiosk.isActive ||
      !kiosk.site.isActive ||
      kiosk.site.status !== "ACTIVE" ||
      !kiosk.deviceId ||
      kiosk.deviceId !== deviceId
    ) {
      return response.status(404).json({
        error: {
          code: "KIOSK_NOT_AVAILABLE",
          message: "Kiosk is unavailable or this device is not activated."
        }
      });
    }

    await prisma.kiosk.update({
      where: { id: kiosk.id },
      data: { lastSeenAt: new Date() }
    });

    return response.status(200).json({
      success: true,
      data: {
        kiosk,
        site: kiosk.site,
        organizations: kiosk.site.organizations.map((item) => item.organization)
      }
    });
  } catch (error) {
    return next(error);
  }
});

