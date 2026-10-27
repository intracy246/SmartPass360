import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireBuilding, type AuthUser } from "../middleware/auth.middleware.js";
import { validateVisitorScan, visitorScanSchema } from "../services/visitor-access.js";

export const accessRouter = Router();

accessRouter.post("/validate", requireBuilding, async (request, response, next) => {
  try {
    const parsed = visitorScanSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ decision: "DENIED", turnstileCommand: "KEEP_LOCKED", error: { code: "VALIDATION_ERROR", message: "A visitor QR, valid gate ID and optional direction are required." } });
    const user = response.locals.authUser as AuthUser;
    const result = await validateVisitorScan(user.siteId!, parsed.data, { hardwareAvailable: false });
    return response.json({ success: true, ...result, data: result });
  } catch (error) { return next(error); }
});

accessRouter.post("/hardware/qr-scan", async (request, response, next) => {
  try {
    const parsed = visitorScanSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        decision: "DENIED",
        turnstileCommand: "KEEP_LOCKED",
        error: { code: "VALIDATION_ERROR", message: "A QR credential and valid gate ID are required." }
      });
    }

    const device = await authenticatePhysicalGateDevice(request, parsed.data.gateId);
    if (!device) {
      return response.status(401).json({
        decision: "DENIED",
        turnstileCommand: "KEEP_LOCKED",
        error: { code: "UNAUTHORIZED_GATE_DEVICE", message: "A provisioned gate device credential is required." }
      });
    }

    const visitorPrefix = "smartpass360://visitor-pass/";
    const permanentPrefix = "smartpass360://permanent-pass/";

    if (parsed.data.credential.startsWith(visitorPrefix)) {
      const result = await validateVisitorScan(device.siteId, parsed.data, { hardwareAvailable: true });
      await prisma.gateAccessDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      return response.json({ success: true, credentialType: "VISITOR", ...result, data: result });
    }

    if (parsed.data.credential.startsWith(permanentPrefix)) {
      request.body = {
        qrCode: parsed.data.credential,
        gateId: parsed.data.gateId,
        requestId: parsed.data.requestId
      };
      return response.status(422).json({
        decision: "ROUTE_PERMANENT_PASS",
        credentialType: "PERMANENT_PASS",
        turnstileCommand: "KEEP_LOCKED",
        route: "/api/v1/access/permanent-pass/scan",
        message: "Permanent-pass credential detected. Route it to the permanent-pass scanner endpoint using the same device key."
      });
    }

    return response.status(400).json({
      decision: "DENIED",
      turnstileCommand: "KEEP_LOCKED",
      error: { code: "UNSUPPORTED_QR_CREDENTIAL", message: "The scanned QR is not a SmartPass360 access credential." }
    });
  } catch (error) {
    return next(error);
  }
});

const hardwareActuationAckSchema = z.object({
  eventId: z.string().uuid(),
  gateId: z.string().uuid(),
  opened: z.boolean(),
  failureCode: z.string().trim().max(120).optional()
});

accessRouter.post("/hardware/ack", async (request, response, next) => {
  try {
    const parsed = hardwareActuationAckSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        success: false,
        turnstileCommand: "KEEP_LOCKED",
        error: { code: "VALIDATION_ERROR", message: "A valid event ID, gate ID and actuator result are required." }
      });
    }

    const device = await authenticatePhysicalGateDevice(request, parsed.data.gateId);
    if (!device) {
      return response.status(401).json({
        success: false,
        turnstileCommand: "KEEP_LOCKED",
        error: { code: "UNAUTHORIZED_GATE_DEVICE", message: "A provisioned gate device credential is required." }
      });
    }

    const event = await prisma.accessEvent.findFirst({
      where: {
        id: parsed.data.eventId,
        siteId: device.siteId,
        gateId: device.gateId,
        decision: "GRANTED"
      },
      select: {
        id: true,
        metadata: true,
        turnstileOpened: true
      }
    });

    if (!event) {
      return response.status(404).json({
        success: false,
        turnstileCommand: "KEEP_LOCKED",
        error: { code: "ACCESS_EVENT_NOT_FOUND", message: "No granted access event was found for this building and gate." }
      });
    }

    const metadata = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
      ? event.metadata as Record<string, unknown>
      : {};

    if (metadata.validationMode !== "HARDWARE" || metadata.commandIssued !== "UNLOCK") {
      return response.status(409).json({
        success: false,
        turnstileCommand: "KEEP_LOCKED",
        error: { code: "HARDWARE_UNLOCK_NOT_AUTHORIZED", message: "This event did not authorize a hardware unlock." }
      });
    }

    const acknowledgedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      // Re-check the event while writing the acknowledgement. Repeated acknowledgements
      // are idempotent; they never issue a new unlock command.
      const latest = await tx.accessEvent.findFirst({
        where: { id: event.id, siteId: device.siteId, gateId: device.gateId, decision: "GRANTED" },
        select: { id: true, metadata: true }
      });
      if (!latest) return null;

      const latestMetadata = latest.metadata && typeof latest.metadata === "object" && !Array.isArray(latest.metadata)
        ? latest.metadata as Record<string, unknown>
        : {};
      if (latestMetadata.validationMode !== "HARDWARE" || latestMetadata.commandIssued !== "UNLOCK") {
        return null;
      }

      return tx.accessEvent.update({
        where: { id: latest.id },
        data: {
          turnstileOpened: parsed.data.opened,
          metadata: {
            validationMode: "HARDWARE",
            commandIssued: "UNLOCK",
            requestedGateId: device.gateId,
            actuatorAcknowledged: true,
            actuatorOpened: parsed.data.opened,
            actuatorFailureCode: parsed.data.opened ? null : (parsed.data.failureCode ?? "ACTUATION_FAILED"),
            actuatorDeviceId: device.id,
            actuatorAcknowledgedAt: acknowledgedAt.toISOString()
          }
        },
        select: { id: true, turnstileOpened: true }
      });
    });

    if (!updated) {
      return response.status(409).json({
        success: false,
        turnstileCommand: "KEEP_LOCKED",
        error: { code: "HARDWARE_ACK_REJECTED", message: "The access event is no longer eligible for acknowledgement." }
      });
    }

    await prisma.gateAccessDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: acknowledgedAt }
    });

    return response.json({
      success: true,
      data: {
        eventId: updated.id,
        gateId: device.gateId,
        actuatorAcknowledged: true,
        turnstileOpened: updated.turnstileOpened,
        turnstileCommand: updated.turnstileOpened ? "UNLOCK_CONFIRMED" : "KEEP_LOCKED",
        acknowledgedAt
      }
    });
  } catch (error) {
    return next(error);
  }
});

accessRouter.get("/gates", requireBuilding, async (_request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const gates = await prisma.gate.findMany({ where: { organization: { siteOrganizations: { some: { siteId: user.siteId!, isActive: true } } } }, select: { id: true, code: true, name: true, location: true, direction: true, isActive: true, status: true, organization: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } });
    return response.json({ success: true, data: gates });
  } catch (error) { return next(error); }
});

accessRouter.get("/operations-summary", requireBuilding, async (_request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const siteId = user.siteId!;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const buildingOrganization = {
      organization: {
        siteOrganizations: {
          some: { siteId, isActive: true }
        }
      }
    };

    const [
      visitorsInside,
      activeVisitorPasses,
      activePermanentPasses,
      visitorEventsToday,
      permanentEventsToday,
      vehicleEventsToday,
      gatesOnline,
      peopleInside,
      recentVisitorEvents,
      recentPermanentEvents
    ] = await Promise.all([
      prisma.visitRequest.count({ where: { siteId, status: "INSIDE" } }),
      prisma.visitorPass.count({
        where: {
          status: "ACTIVE",
          validFrom: { lte: now },
          validUntil: { gt: now },
          visit: { siteId }
        }
      }),
      prisma.permanentPass.count({
        where: {
          status: "ACTIVE",
          validFrom: { lte: now },
          OR: [
            { expiryType: "LIFETIME" },
            { expiryType: "FIXED_DATE", expiresAt: { gt: now } }
          ],
          ...buildingOrganization
        }
      }),
      prisma.accessEvent.count({ where: { siteId, scannedAt: { gte: startOfDay } } }),
      prisma.permanentPassAccessEvent.count({
        where: { occurredAt: { gte: startOfDay }, ...buildingOrganization }
      }),
      prisma.vehicleAccessEvent.count({ where: { siteId, occurredAt: { gte: startOfDay } } }),
      prisma.gate.count({ where: { isActive: true, status: "ONLINE", ...buildingOrganization } }),
      prisma.permanentPass.findMany({
        where: { isCurrentlyInside: true, status: "ACTIVE", ...buildingOrganization },
        select: {
          id: true,
          passNumber: true,
          fullName: true,
          department: true,
          lastActivityAt: true,
          organization: { select: { name: true } }
        },
        orderBy: { lastActivityAt: "desc" },
        take: 8
      }),
      prisma.accessEvent.findMany({
        where: { siteId },
        include: {
          gate: { select: { name: true } },
          visitorPass: { select: { passNumber: true } },
          visit: { select: { visitor: { select: { fullName: true } } } }
        },
        orderBy: { scannedAt: "desc" },
        take: 8
      }),
      prisma.permanentPassAccessEvent.findMany({
        where: buildingOrganization,
        include: {
          permanentPass: { select: { passNumber: true, fullName: true } }
        },
        orderBy: { occurredAt: "desc" },
        take: 8
      })
    ]);

    const activity = [
      ...recentVisitorEvents.map((event) => ({
        id: event.id,
        kind: "VISITOR" as const,
        name: event.visit?.visitor.fullName ?? "Visitor",
        passNumber: event.visitorPass?.passNumber ?? null,
        direction: event.direction,
        decision: event.decision,
        gateName: event.gate?.name ?? null,
        occurredAt: event.scannedAt
      })),
      ...recentPermanentEvents.map((event) => ({
        id: event.id,
        kind: "PERMANENT_PASS" as const,
        name: event.permanentPass.fullName,
        passNumber: event.permanentPass.passNumber,
        direction: event.activityType,
        decision: event.decision,
        gateName: null,
        occurredAt: event.occurredAt
      }))
    ]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 8);

    response.setHeader("Cache-Control", "no-store");
    return response.json({
      success: true,
      data: {
        visitorsInside,
        activePasses: activeVisitorPasses + activePermanentPasses,
        accessEventsToday: visitorEventsToday + permanentEventsToday + vehicleEventsToday,
        gatesOnline,
        peopleInside,
        recentActivity: activity
      }
    });
  } catch (error) {
    return next(error);
  }
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

function getGateDeviceKey(request: any) {
  const raw = request.headers["x-gate-device-key"] ?? request.headers["x-device-key"];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

async function authenticatePhysicalGateDevice(request: any, gateId: string) {
  const key = getGateDeviceKey(request);
  if (!key) return null;

  return prisma.gateAccessDevice.findFirst({
    where: {
      gateId,
      deviceKeyHash: hashGateDeviceKey(key),
      isActive: true,
      site: { isActive: true, status: "ACTIVE" },
      gate: {
        isActive: true,
        status: "ONLINE",
        organization: {
          isActive: true,
          siteOrganizations: { some: { isActive: true } }
        }
      }
    },
    include: { gate: true }
  });
}

const scanSchema = z.object({
  qrCode: z.string().trim().min(1).max(2000),
  gateId: z.string().uuid(),
  requestId: z.string().uuid().optional()
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
  "/permanent-pass/validate",
  requireBuilding,
  async (request, response, next) => {
    try {
      const parsed = scanSchema.safeParse(request.body);
      if (!parsed.success) {
        return response.status(400).json({
          decision: "DENIED",
          turnstileCommand: "KEEP_LOCKED",
          error: {
            code: "VALIDATION_ERROR",
            message: "A permanent-pass QR and valid gate ID are required.",
            details: parsed.error.flatten()
          }
        });
      }

      const user = response.locals.authUser as AuthUser;
      const token = extractPermanentPassToken(parsed.data.qrCode);
      if (!token) {
        return response.status(200).json({
          decision: "DENIED",
          denialReason: "INVALID_QR_FORMAT",
          activityType: "ENTRY",
          turnstileCommand: "KEEP_LOCKED",
          message: "This QR is not a SmartPass360 permanent-pass credential."
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        if (parsed.data.requestId) {
          const duplicate = await tx.permanentPassAccessEvent.findFirst({
            where: {
              gateId: parsed.data.gateId,
              metadata: { path: ["requestId"], equals: parsed.data.requestId }
            },
            orderBy: { occurredAt: "desc" }
          });
          if (duplicate) {
            const duplicatePass = await tx.permanentPass.findUnique({
              where: { id: duplicate.permanentPassId },
              select: { passNumber: true, fullName: true }
            });
            return {
              decision: duplicate.decision,
              denialReason: duplicate.denialReason ?? undefined,
              activityType: duplicate.activityType,
              turnstileCommand: "KEEP_LOCKED" as const,
              accessEventId: duplicate.id,
              duplicate: true,
              message: "Duplicate scan request; no new gate command.",
              holder: duplicatePass ? { passNumber: duplicatePass.passNumber, fullName: duplicatePass.fullName } : undefined
            };
          }
        }

        const gate = await tx.gate.findFirst({
          where: {
            id: parsed.data.gateId,
            isActive: true,
            organization: {
              isActive: true,
              siteOrganizations: { some: { siteId: user.siteId!, isActive: true } }
            }
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                isActive: true,
                siteOrganizations: {
                  where: { isActive: true },
                  select: { siteId: true, site: { select: { isActive: true, status: true } } }
                }
              }
            }
          }
        });

        if (!gate) {
          return {
            decision: "DENIED" as const,
            denialReason: "WRONG_GATE",
            activityType: "ENTRY" as const,
            turnstileCommand: "KEEP_LOCKED" as const,
            message: "This gate is not active or does not belong to your building."
          };
        }

        await tx.$queryRaw`SELECT id FROM permanent_passes WHERE qr_token_hash = ${hashQrToken(token)} FOR UPDATE`;
        const permanentPass = await tx.permanentPass.findUnique({
          where: { qrTokenHash: hashQrToken(token) },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                isActive: true,
                siteOrganizations: {
                  where: { isActive: true },
                  select: { siteId: true }
                }
              }
            }
          }
        });

        if (!permanentPass) {
          const event = null;
          return {
            decision: "DENIED" as const,
            denialReason: "INVALID_CREDENTIAL",
            activityType: "ENTRY" as const,
            turnstileCommand: "KEEP_LOCKED" as const,
            message: "No active permanent pass matches this QR.",
            event
          };
        }

        const now = new Date();
        const activityType = permanentPass.isCurrentlyInside ? "EXIT" as const : "ENTRY" as const;
        const gateSites = gate.organization.siteOrganizations;
        const passSiteIds = new Set(permanentPass.organization.siteOrganizations.map((item) => item.siteId));
        const sharedSite = gateSites.find((item) => passSiteIds.has(item.siteId) && item.siteId === user.siteId);

        let denialReason: string | null = null;
        if (!sharedSite) denialReason = "BUILDING_MISMATCH";
        else if (!sharedSite.site.isActive || sharedSite.site.status !== "ACTIVE") denialReason = "BUILDING_INACTIVE";
        else if (!permanentPass.organization.isActive && activityType !== "EXIT") denialReason = "ORGANIZATION_INACTIVE";
        else if (permanentPass.status !== "ACTIVE" && activityType !== "EXIT") denialReason = `PASS_${permanentPass.status}`;
        else if (permanentPass.validFrom.getTime() > now.getTime() && activityType !== "EXIT") denialReason = "PASS_NOT_YET_VALID";
        else if (
          activityType !== "EXIT" &&
          permanentPass.expiryType === "FIXED_DATE" &&
          permanentPass.expiresAt &&
          permanentPass.expiresAt.getTime() <= now.getTime()
        ) denialReason = "PASS_EXPIRED";
        else if (gate.direction !== "BIDIRECTIONAL" && gate.direction !== activityType) {
          denialReason = activityType === "ENTRY" ? "ENTRY_NOT_ALLOWED_AT_GATE" : "EXIT_NOT_ALLOWED_AT_GATE";
        }

        const event = await tx.permanentPassAccessEvent.create({
          data: {
            organizationId: permanentPass.organizationId,
            permanentPassId: permanentPass.id,
            gateId: gate.id,
            activityType,
            decision: denialReason ? "DENIED" : "GRANTED",
            denialReason,
            turnstileOpened: false,
            metadata: {
              validationMode: "SOFTWARE",
              commandIssued: denialReason ? "KEEP_LOCKED" : "VALIDATED_ONLY",
              gateCode: gate.code,
              gateName: gate.name,
              requestId: parsed.data.requestId ?? null,
              validatedBy: user.username
            }
          }
        });

        if (!denialReason) {
          await tx.permanentPass.update({
            where: { id: permanentPass.id },
            data: {
              isCurrentlyInside: activityType === "ENTRY",
              lastActivityType: activityType,
              lastActivityAt: now
            }
          });
        }

        return {
          decision: denialReason ? "DENIED" as const : "GRANTED" as const,
          denialReason: denialReason ?? undefined,
          activityType,
          turnstileCommand: denialReason ? "KEEP_LOCKED" as const : "VALIDATED_ONLY" as const,
          accessEventId: event.id,
          occurredAt: event.occurredAt.toISOString(),
          message: denialReason
            ? `Access denied: ${denialReason}.`
            : `Permanent pass ${activityType.toLowerCase()} validated and recorded. No physical turnstile was actuated.`,
          gate: { id: gate.id, code: gate.code, name: gate.name, direction: gate.direction },
          holder: {
            permanentPassId: permanentPass.id,
            passNumber: permanentPass.passNumber,
            fullName: permanentPass.fullName,
            staffNumber: permanentPass.staffNumber,
            department: permanentPass.department,
            position: permanentPass.position,
            holderType: permanentPass.holderType,
            photoUrl: permanentPass.photoUrl
          }
        };
      }, { isolationLevel: "Serializable" });

      response.setHeader("Cache-Control", "no-store");
      return response.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
);

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

      const physicalDevice = await authenticatePhysicalGateDevice(request, parsed.data.gateId);
      if (!physicalDevice) {
        response.status(401).json({
          decision: "DENIED",
          denialReason: "UNAUTHORIZED_GATE_DEVICE",
          turnstileCommand: "KEEP_LOCKED"
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

      if (parsed.data.requestId) {
        const duplicate = await prisma.permanentPassAccessEvent.findFirst({
          where: {
            gateId: parsed.data.gateId,
            metadata: {
              path: ["requestId"],
              equals: parsed.data.requestId
            }
          },
          orderBy: { occurredAt: "desc" }
        });
        if (duplicate) {
          response.status(200).json({
            decision: duplicate.decision,
            denialReason: duplicate.denialReason,
            activityType: duplicate.activityType,
            turnstileCommand: "KEEP_LOCKED",
            accessEventId: duplicate.id,
            duplicate: true,
            message: "Duplicate scanner request; no new unlock command."
          });
          return;
        }
      }

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
                  isActive: true,
                  siteOrganizations: {
                    where: { isActive: true },
                    select: {
                      siteId: true,
                      site: { select: { isActive: true, status: true } }
                    }
                  }
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
                  isActive: true,
                  siteOrganizations: {
                    where: { isActive: true },
                    select: { siteId: true }
                  }
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

      const gateSites = gate.organization.siteOrganizations;
      const passSiteIds = new Set(permanentPass.organization.siteOrganizations.map((item) => item.siteId));
      const sharedSite = gateSites.find((item) => passSiteIds.has(item.siteId));

      let denialReason: string | null = null;

      if (!sharedSite) {
        denialReason = "BUILDING_MISMATCH";
      } else if (!sharedSite.site.isActive || sharedSite.site.status !== "ACTIVE") {
        denialReason = "BUILDING_INACTIVE";
      }

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
              gateName: gate.name,
              requestId: parsed.data.requestId ?? null,
              gateDeviceId: physicalDevice.id
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
                    commandIssued: "UNLOCK",
                    requestId: parsed.data.requestId ?? null,
                    gateDeviceId: physicalDevice.id
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

