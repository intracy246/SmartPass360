import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireBuilding, type AuthUser } from "../middleware/auth.middleware";
import { validateVisitorScan, visitorScanSchema } from "../services/visitor-access";

export const accessRouter = Router();

accessRouter.post("/validate", requireBuilding, async (request, response, next) => {
  try {
    const parsed = visitorScanSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ decision: "DENIED", turnstileCommand: "KEEP_LOCKED", error: { code: "VALIDATION_ERROR", message: "A visitor QR, valid gate ID and optional direction are required." } });
    const user = response.locals.authUser as AuthUser;
    const result = await validateVisitorScan(user.siteId!, parsed.data);
    return response.json({ success: true, ...result, data: result });
  } catch (error) { return next(error); }
});

accessRouter.get("/gates", requireBuilding, async (_request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const gates = await prisma.gate.findMany({ where: { organization: { siteOrganizations: { some: { siteId: user.siteId!, isActive: true } } } }, select: { id: true, name: true, direction: true, isActive: true, status: true } });
    return response.json({ success: true, data: gates });
  } catch (error) { return next(error); }
});

accessRouter.get("/events", requireBuilding, async (request, response, next) => {
  try {
    const parsed = z.object({ page: z.coerce.number().int().positive().default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).safeParse(request.query);
    if (!parsed.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid event pagination." } });
    const user = response.locals.authUser as AuthUser;
    const { page, pageSize } = parsed.data;
    const where = { siteId: user.siteId! };
    const [events, total] = await Promise.all([
      prisma.accessEvent.findMany({ where, include: { gate: true, visitorPass: { select: { passNumber: true } }, visit: { select: { visitor: { select: { fullName: true } } } } }, orderBy: { scannedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.accessEvent.count({ where })
    ]);
    return response.json({ success: true, data: events.map(event => ({ id: event.id, visitorName: event.visit?.visitor.fullName, passNumber: event.visitorPass?.passNumber, gateName: event.gate?.name, direction: event.direction, decision: event.decision, reason: event.denialReason ?? "VALID_PASS", occurredAt: event.scannedAt })), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) { return next(error); }
});


const gateCreateSchema = z.object({
  organizationId: z.string().uuid(),
  code: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(120),
  location: z.string().trim().max(200).optional(),
  direction: z.enum(["ENTRY", "EXIT", "BIDIRECTIONAL"]).default("BIDIRECTIONAL")
});

const gateUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  direction: z.enum(["ENTRY", "EXIT", "BIDIRECTIONAL"]).optional(),
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE"]).optional(),
  isActive: z.boolean().optional()
}).refine(value => Object.keys(value).length > 0, {
  message: "At least one gate field is required."
});

const deviceCreateSchema = z.object({
  name: z.string().trim().min(2).max(120)
});

function createGateDeviceKey() {
  return `spg_${crypto.randomBytes(32).toString("base64url")}`;
}

function hashGateDeviceKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function findBuildingGate(siteId: string, gateId: string) {
  return prisma.gate.findFirst({
    where: {
      id: gateId,
      organization: {
        siteOrganizations: {
          some: {
            siteId,
            isActive: true
          }
        }
      }
    }
  });
}

accessRouter.post("/gates", requireBuilding, async (request, response, next) => {
  try {
    const parsed = gateCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid gate data.", details: parsed.error.flatten() }
      });
    }

    const user = response.locals.authUser as AuthUser;
    const linkedOrganization = await prisma.siteOrganization.findFirst({
      where: {
        siteId: user.siteId!,
        organizationId: parsed.data.organizationId,
        isActive: true,
        organization: { isActive: true }
      },
      select: { id: true }
    });

    if (!linkedOrganization) {
      return response.status(403).json({
        error: { code: "INVALID_ORGANIZATION", message: "The selected organization does not belong to this building." }
      });
    }

    const gate = await prisma.gate.create({
      data: {
        organizationId: parsed.data.organizationId,
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        location: parsed.data.location || null,
        direction: parsed.data.direction
      }
    });

    return response.status(201).json({ success: true, data: gate });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return response.status(409).json({
        error: { code: "GATE_CODE_EXISTS", message: "This gate code already exists for the organization." }
      });
    }
    return next(error);
  }
});

accessRouter.patch("/gates/:gateId", requireBuilding, async (request, response, next) => {
  try {
    const gateId = z.string().uuid().safeParse(request.params.gateId);
    const parsed = gateUpdateSchema.safeParse(request.body);
    if (!gateId.success || !parsed.success) {
      return response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid gate update." }
      });
    }

    const user = response.locals.authUser as AuthUser;
    const existing = await findBuildingGate(user.siteId!, gateId.data);
    if (!existing) {
      return response.status(404).json({
        error: { code: "GATE_NOT_FOUND", message: "Gate was not found in this building." }
      });
    }

    const gate = await prisma.gate.update({
      where: { id: existing.id },
      data: parsed.data
    });

    return response.json({ success: true, data: gate });
  } catch (error) {
    return next(error);
  }
});

accessRouter.get("/gate-devices", requireBuilding, async (_request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const devices = await prisma.gateAccessDevice.findMany({
      where: { siteId: user.siteId! },
      include: {
        gate: {
          select: { id: true, code: true, name: true, direction: true, status: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return response.json({
      success: true,
      data: devices.map(device => ({
        id: device.id,
        name: device.name,
        isActive: device.isActive,
        lastSeenAt: device.lastSeenAt,
        createdAt: device.createdAt,
        gate: device.gate
      }))
    });
  } catch (error) {
    return next(error);
  }
});

accessRouter.post("/gates/:gateId/devices", requireBuilding, async (request, response, next) => {
  try {
    const gateId = z.string().uuid().safeParse(request.params.gateId);
    const parsed = deviceCreateSchema.safeParse(request.body);
    if (!gateId.success || !parsed.success) {
      return response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "A valid gate and device name are required." }
      });
    }

    const user = response.locals.authUser as AuthUser;
    const gate = await findBuildingGate(user.siteId!, gateId.data);
    if (!gate) {
      return response.status(404).json({
        error: { code: "GATE_NOT_FOUND", message: "Gate was not found in this building." }
      });
    }

    const deviceKey = createGateDeviceKey();
    const device = await prisma.gateAccessDevice.create({
      data: {
        siteId: user.siteId!,
        gateId: gate.id,
        name: parsed.data.name,
        deviceKeyHash: hashGateDeviceKey(deviceKey)
      }
    });

    return response.status(201).json({
      success: true,
      data: {
        id: device.id,
        name: device.name,
        gateId: device.gateId,
        isActive: device.isActive,
        deviceKey,
        createdAt: device.createdAt
      },
      message: "Gate device created. Save the device key now; it will not be shown again."
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return response.status(409).json({
        error: { code: "DEVICE_NAME_EXISTS", message: "A device with this name already exists on the selected gate." }
      });
    }
    return next(error);
  }
});

accessRouter.post("/gate-devices/:deviceId/rotate-key", requireBuilding, async (request, response, next) => {
  try {
    const deviceId = z.string().uuid().safeParse(request.params.deviceId);
    if (!deviceId.success) {
      return response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "A valid gate device ID is required." }
      });
    }

    const user = response.locals.authUser as AuthUser;
    const existing = await prisma.gateAccessDevice.findFirst({
      where: { id: deviceId.data, siteId: user.siteId! }
    });

    if (!existing) {
      return response.status(404).json({
        error: { code: "GATE_DEVICE_NOT_FOUND", message: "Gate device was not found." }
      });
    }

    const deviceKey = createGateDeviceKey();
    const device = await prisma.gateAccessDevice.update({
      where: { id: existing.id },
      data: { deviceKeyHash: hashGateDeviceKey(deviceKey) }
    });

    return response.json({
      success: true,
      data: { id: device.id, name: device.name, deviceKey },
      message: "Device key rotated. The previous key is no longer valid."
    });
  } catch (error) {
    return next(error);
  }
});

accessRouter.patch("/gate-devices/:deviceId", requireBuilding, async (request, response, next) => {
  try {
    const deviceId = z.string().uuid().safeParse(request.params.deviceId);
    const parsed = z.object({ isActive: z.boolean() }).safeParse(request.body);
    if (!deviceId.success || !parsed.success) {
      return response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid gate device update." }
      });
    }

    const user = response.locals.authUser as AuthUser;
    const existing = await prisma.gateAccessDevice.findFirst({
      where: { id: deviceId.data, siteId: user.siteId! }
    });

    if (!existing) {
      return response.status(404).json({
        error: { code: "GATE_DEVICE_NOT_FOUND", message: "Gate device was not found." }
      });
    }

    const device = await prisma.gateAccessDevice.update({
      where: { id: existing.id },
      data: { isActive: parsed.data.isActive }
    });

    return response.json({ success: true, data: device });
  } catch (error) {
    return next(error);
  }
});

const scanSchema = z.object({
  qrCode: z.string().trim().min(1).max(2000),
  gateId: z.string().uuid()
});

function extractPermanentPassToken(qrCode: string) {
  const prefix = "smartpass360://permanent-pass/";

  if (qrCode.startsWith(prefix)) {
    const token = qrCode.slice(prefix.length).trim();
    return token.length > 0 ? token : null;
  }

  // Allows scanners that submit only the raw credential token.
  if (/^[A-Za-z0-9_-]{20,200}$/.test(qrCode)) {
    return qrCode;
  }

  return null;
}

function hashQrToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

accessRouter.post(
  "/permanent-pass/scan",
  async (request, response, next) => {
    try {
      const parsed = scanSchema.safeParse(request.body);

      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid gate scan request.",
            details: parsed.error.flatten()
          }
        });
        return;
      }

      const token = extractPermanentPassToken(
        parsed.data.qrCode
      );

      if (!token) {
        response.status(400).json({
          decision: "DENIED",
          denialReason: "INVALID_QR_FORMAT",
          turnstileCommand: "KEEP_LOCKED"
        });
        return;
      }

      const tokenHash = hashQrToken(token);

      const [gate, permanentPass] =
        await Promise.all([
          prisma.gate.findUnique({
            where: {
              id: parsed.data.gateId
            },
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  isActive: true
                }
              }
            }
          }),

          prisma.permanentPass.findUnique({
            where: {
              qrTokenHash: tokenHash
            },
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  isActive: true
                }
              }
            }
          })
        ]);

      if (!gate) {
        response.status(404).json({
          decision: "DENIED",
          denialReason: "GATE_NOT_FOUND",
          turnstileCommand: "KEEP_LOCKED"
        });
        return;
      }

      if (
        !gate.isActive ||
        gate.status !== "ONLINE" ||
        !gate.organization.isActive
      ) {
        response.status(403).json({
          decision: "DENIED",
          denialReason: "GATE_UNAVAILABLE",
          turnstileCommand: "KEEP_LOCKED"
        });
        return;
      }

      if (!permanentPass) {
        response.status(403).json({
          decision: "DENIED",
          denialReason: "INVALID_CREDENTIAL",
          turnstileCommand: "KEEP_LOCKED"
        });
        return;
      }

      const now = new Date();

      let denialReason: string | null = null;

      if (!permanentPass.organization.isActive) {
        denialReason = "ORGANIZATION_INACTIVE";

      } else if (permanentPass.status !== "ACTIVE") {
        denialReason =
          `PASS_${permanentPass.status}`;
      } else if (
        permanentPass.validFrom.getTime() >
        now.getTime()
      ) {
        denialReason = "PASS_NOT_YET_VALID";
      } else if (
        permanentPass.expiryType === "FIXED_DATE" &&
        permanentPass.expiresAt &&
        permanentPass.expiresAt.getTime() <=
          now.getTime()
      ) {
        denialReason = "PASS_EXPIRED";
      }

      const activityType =
        permanentPass.isCurrentlyInside
          ? "EXIT"
          : "ENTRY";

      if (
        !denialReason &&
        gate.direction !== "BIDIRECTIONAL" &&
        gate.direction !== activityType
      ) {
        denialReason =
          activityType === "ENTRY"
            ? "ENTRY_NOT_ALLOWED_AT_GATE"
            : "EXIT_NOT_ALLOWED_AT_GATE";
      }

      if (denialReason) {
        await prisma.permanentPassAccessEvent.create({
          data: {
            organizationId:
              permanentPass.organizationId,

            permanentPassId:
              permanentPass.id,

            gateId:
              gate.id,

            activityType,

            decision: "DENIED",

            denialReason,

            turnstileOpened: false,

            metadata: {
              gateCode: gate.code,
              gateName: gate.name
            }
          }
        });

        response.status(403).json({
          decision: "DENIED",
          denialReason,
          activityType,
          turnstileCommand: "KEEP_LOCKED",

          gate: {
            id: gate.id,
            code: gate.code,
            name: gate.name
          },

          holder: {
            passNumber:
              permanentPass.passNumber,
            fullName:
              permanentPass.fullName
          }
        });

        return;
      }

      const event = await prisma.$transaction(
        async (transaction) => {
          const accessEvent =
            await transaction
              .permanentPassAccessEvent
              .create({
                data: {
                  organizationId:
                    permanentPass.organizationId,

                  permanentPassId:
                    permanentPass.id,

                  gateId:
                    gate.id,

                  activityType,

                  decision: "GRANTED",

                  turnstileOpened: false,

                  metadata: {
                    gateCode: gate.code,
                    gateName: gate.name,
                    commandIssued: "UNLOCK"
                  }
                }
              });

          await transaction.permanentPass.update({
            where: {
              id: permanentPass.id
            },

            data: {
              isCurrentlyInside:
                activityType === "ENTRY",

              lastActivityType:
                activityType,

              lastActivityAt:
                now
            }
          });

          return accessEvent;
        }
      );

      response.status(200).json({
        decision: "GRANTED",
        activityType,

        turnstileCommand: "UNLOCK",

        accessEventId: event.id,

        occurredAt:
          event.occurredAt.toISOString(),

        gate: {
          id: gate.id,
          code: gate.code,
          name: gate.name,
          direction: gate.direction
        },

        holder: {
          permanentPassId:
            permanentPass.id,

          passNumber:
            permanentPass.passNumber,

          fullName:
            permanentPass.fullName,

          staffNumber:
            permanentPass.staffNumber,

          department:
            permanentPass.department,

          position:
            permanentPass.position,

          holderType:
            permanentPass.holderType,

          photoUrl:
            permanentPass.photoUrl
        }
      });

      return;
    } catch (error) {
      next(error);
    }
  }
);

