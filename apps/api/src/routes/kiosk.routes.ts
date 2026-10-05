import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireBuilding, type AuthUser } from "../middleware/auth.middleware";

export const kioskRouter = Router();

function createActivationCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}

const siteCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(40),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  organizationIds: z.array(z.string().uuid()).default([])
});

const siteUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  logoUrl: z.string().max(1500000).nullable().optional()
});

const kioskCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(40),
  location: z.string().trim().optional()
});

const activateSchema = z.object({
  activationCode: z.string().trim().min(6).max(64),
  deviceId: z.string().trim().min(3).max(160)
});

kioskRouter.get("/sites", async (_request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;

    const kiosk = await prisma.kiosk.create({
      data: {
        siteId: user.siteId!,
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        location: parsed.data.location || undefined,
        activationCode: createActivationCode()
      },
      include: {
        site: true
      }
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
              include: {
                organization: true
              }
            }
          }
        }
      }
    });

    if (!kiosk || !kiosk.isActive || !kiosk.site.isActive) {
      return response.status(404).json({
        error: {
          code: "KIOSK_NOT_AVAILABLE",
          message: "Kiosk activation code is invalid or inactive."
        }
      });
    }

    const updated = await prisma.kiosk.update({
      where: { id: kiosk.id },
      data: {
        deviceId: parsed.data.deviceId,
        activatedAt: new Date(),
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

kioskRouter.get("/:kioskId/config", async (request, response, next) => {
  try {
    const kiosk = await prisma.kiosk.findUnique({
      where: { id: request.params.kioskId },
      include: {
        site: {
          include: {
            organizations: {
              where: { isActive: true },
              include: {
                organization: true
              }
            }
          }
        }
      }
    });

    if (!kiosk || !kiosk.isActive || !kiosk.site.isActive) {
      return response.status(404).json({
        error: {
          code: "KIOSK_NOT_AVAILABLE",
          message: "Kiosk is unavailable."
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
