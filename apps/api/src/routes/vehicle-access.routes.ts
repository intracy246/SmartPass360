import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireBuilding, type AuthUser } from "../middleware/auth.middleware";

export const vehicleAccessRouter = Router();

const directionSchema = z.enum(["ENTRY", "EXIT"]);

function normalizePlateNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashDeviceKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getDeviceKey(request: any) {
  const raw =
    request.headers["x-gate-device-key"] ??
    request.headers["x-device-key"];

  return typeof raw === "string" && raw.trim()
    ? raw.trim()
    : null;
}

async function authenticateGateDevice(request: any) {
  const key = getDeviceKey(request);
  if (!key) return null;

  return prisma.gateAccessDevice.findFirst({
    where: {
      deviceKeyHash: hashDeviceKey(key),
      isActive: true,
      site: {
        isActive: true,
        status: "ACTIVE"
      },
      gate: {
        isActive: true,
        status: "ONLINE"
      }
    },
    include: {
      gate: {
        include: {
          organization: {
            select: {
              id: true,
              isActive: true,
              siteOrganizations: {
                select: {
                  siteId: true,
                  isActive: true
                }
              }
            }
          }
        }
      }
    }
  });
}

async function findExpectedVisitorVehicle(siteId: string, normalizedPlateNumber: string, direction: "ENTRY" | "EXIT", now: Date) {
  const candidates = await prisma.visitRequest.findMany({
    where: {
      siteId,
      status: direction === "ENTRY"
        ? { in: ["APPROVED", "PASS_ISSUED", "READY_FOR_ENTRY"] }
        : "INSIDE",
      visitor: { vehicleNumber: { not: null } },
      organization: { isActive: true },
      pass: {
        is: {
          status: "ACTIVE",
          validFrom: { lte: now },
          validUntil: { gt: now }
        }
      }
    },
    include: {
      visitor: { select: { id: true, fullName: true, vehicleNumber: true } },
      organization: {
        select: {
          id: true,
          name: true,
          siteOrganizations: {
            where: { siteId, isActive: true },
            select: { id: true }
          }
        }
      },
      pass: { select: { id: true, passNumber: true, status: true, validFrom: true, validUntil: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return candidates.find((visit) =>
    visit.visitor.vehicleNumber &&
    normalizePlateNumber(visit.visitor.vehicleNumber) === normalizedPlateNumber &&
    visit.organization.siteOrganizations.length > 0
  ) ?? null;
}

function commandMetadata(base: Record<string, unknown>, status: "PENDING" | "DELIVERED_INLINE") {
  return {
    ...base,
    gateCommand: {
      type: "UNLOCK",
      status,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30_000).toISOString()
    }
  };
}

function passIsValid(pass: any, now = new Date()) {
  if (!pass) return { valid: false, reason: "PASS_NOT_FOUND" };
  if (pass.status !== "ACTIVE") return { valid: false, reason: `PASS_${pass.status}` };
  if (pass.validFrom.getTime() > now.getTime()) return { valid: false, reason: "PASS_NOT_YET_VALID" };
  if (
    pass.expiryType === "FIXED_DATE" &&
    pass.expiresAt &&
    pass.expiresAt.getTime() <= now.getTime()
  ) {
    return { valid: false, reason: "PASS_EXPIRED" };
  }
  if (!pass.organization?.isActive) return { valid: false, reason: "ORGANIZATION_INACTIVE" };
  return { valid: true, reason: "REGISTERED_PERMANENT_PASS" };
}

vehicleAccessRouter.post("/recognize", async (request, response, next) => {
  try {
    const parsed = z.object({
      plateNumber: z.string().trim().min(3).max(30),
      direction: directionSchema.optional(),
      confidence: z.number().min(0).max(1).optional(),
      snapshotUrl: z.string().trim().url().max(2000).optional(),
      requestId: z.string().trim().min(1).max(200).optional()
    }).safeParse(request.body);

    if (!parsed.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Plate number and valid ANPR metadata are required.",
          details: parsed.error.flatten()
        }
      });
    }

    const device = await authenticateGateDevice(request);
    if (!device) {
      return response.status(401).json({
        error: {
          code: "UNAUTHORIZED_GATE_DEVICE",
          message: "A valid gate device credential is required."
        }
      });
    }

    const siteId = device.siteId;
    const gate = device.gate;
    const normalizedPlateNumber = normalizePlateNumber(parsed.data.plateNumber);
    const direction =
      parsed.data.direction ??
      (gate.direction === "EXIT" ? "EXIT" : "ENTRY");

    if (
      gate.direction !== "BIDIRECTIONAL" &&
      gate.direction !== direction
    ) {
      return response.status(403).json({
        decision: "DENIED",
        action: "KEEP_LOCKED",
        reason: "WRONG_GATE_DIRECTION"
      });
    }

    if (parsed.data.requestId) {
      const existingEvent = await prisma.vehicleAccessEvent.findUnique({
        where: {
          siteId_deviceRequestId: {
            siteId,
            deviceRequestId: parsed.data.requestId
          }
        }
      });
      if (existingEvent) {
        return response.status(200).json({
          decision: existingEvent.decision,
          action: existingEvent.action,
          reason: existingEvent.reason,
          eventId: existingEvent.id,
          duplicate: true
        });
      }
    }

    const lowConfidence =
      parsed.data.confidence !== undefined &&
      parsed.data.confidence < 0.8;

    const vehicle = await prisma.authorizedVehicle.findFirst({
      where: {
        siteId,
        normalizedPlateNumber,
        isActive: true
      },
      include: {
        permanentPass: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                isActive: true,
                siteOrganizations: {
                  where: {
                    siteId,
                    isActive: true
                  },
                  select: {
                    id: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const now = new Date();
    const passCheck = vehicle
      ? passIsValid(vehicle.permanentPass, now)
      : { valid: false, reason: "UNKNOWN_VEHICLE" };

    if (
      vehicle &&
      passCheck.valid &&
      !lowConfidence &&
      vehicle.permanentPass.organization.siteOrganizations.length > 0
    ) {
      const event = await prisma.$transaction(async (transaction) => {
        const created = await transaction.vehicleAccessEvent.create({
          data: {
            siteId,
            organizationId: vehicle.permanentPass.organizationId,
            authorizedVehicleId: vehicle.id,
            permanentPassId: vehicle.permanentPass.id,
            gateId: gate.id,
            gateAccessDeviceId: device.id,
            deviceRequestId: parsed.data.requestId ?? null,
            plateNumber: parsed.data.plateNumber.trim().toUpperCase(),
            normalizedPlateNumber,
            direction,
            decision: "AUTHORIZED",
            action: "UNLOCK",
            confidence: parsed.data.confidence ?? null,
            reason: "REGISTERED_PERMANENT_PASS",
            metadata: commandMetadata({
              gateDeviceId: device.id,
              gateDeviceName: device.name
            }, "DELIVERED_INLINE")
          }
        });

        await transaction.authorizedVehicle.update({
          where: { id: vehicle.id },
          data: direction === "ENTRY"
            ? {
                isCurrentlyInside: true,
                lastEntryAt: now
              }
            : {
                isCurrentlyInside: false,
                lastExitAt: now
              }
        });

        return created;
      });

      await prisma.gateAccessDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: now }
      });

      return response.status(200).json({
        decision: "AUTHORIZED",
        action: "UNLOCK",
        reason: "REGISTERED_PERMANENT_PASS",
        eventId: event.id,
        vehicle: {
          id: vehicle.id,
          plateNumber: vehicle.plateNumber,
          isCurrentlyInside: direction === "ENTRY"
        },
        holder: {
          permanentPassId: vehicle.permanentPass.id,
          passNumber: vehicle.permanentPass.passNumber,
          fullName: vehicle.permanentPass.fullName
        },
        gate: {
          id: gate.id,
          name: gate.name,
          direction
        }
      });
    }

    if (!vehicle && !lowConfidence) {
      const expectedVisit = await findExpectedVisitorVehicle(siteId, normalizedPlateNumber, direction, now);

      if (expectedVisit?.pass) {
        const visitorPass = expectedVisit.pass;
        const event = await prisma.$transaction(async (transaction) => {
          const created = await transaction.vehicleAccessEvent.create({
            data: {
              siteId,
              organizationId: expectedVisit.organizationId,
              gateId: gate.id,
              gateAccessDeviceId: device.id,
              deviceRequestId: parsed.data.requestId ?? null,
              plateNumber: parsed.data.plateNumber.trim().toUpperCase(),
              normalizedPlateNumber,
              direction,
              decision: "AUTHORIZED",
              action: "UNLOCK",
              confidence: parsed.data.confidence ?? null,
              reason: "EXPECTED_VISITOR",
              metadata: commandMetadata({
                gateDeviceId: device.id,
                gateDeviceName: device.name,
                visitId: expectedVisit.id,
                visitorPassId: visitorPass.id,
                visitorName: expectedVisit.visitor.fullName,
                passNumber: visitorPass.passNumber
              }, "DELIVERED_INLINE")
            }
          });

          await transaction.visitRequest.update({
            where: { id: expectedVisit.id },
            data: direction === "ENTRY"
              ? { status: "INSIDE", checkedInAt: now }
              : { status: "CHECKED_OUT", checkedOutAt: now }
          });

          if (direction === "EXIT") {
            await transaction.visitorPass.update({
              where: { id: visitorPass.id },
              data: { status: "USED" }
            });
          }

          return created;
        });

        await prisma.gateAccessDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: now }
        });

        return response.status(200).json({
          decision: "AUTHORIZED",
          action: "UNLOCK",
          reason: "EXPECTED_VISITOR",
          eventId: event.id,
          visitor: {
            visitId: expectedVisit.id,
            visitorId: expectedVisit.visitor.id,
            fullName: expectedVisit.visitor.fullName,
            passNumber: visitorPass.passNumber,
            vehicleNumber: expectedVisit.visitor.vehicleNumber
          },
          gate: { id: gate.id, name: gate.name, direction }
        });
      }
    }

    const requestReason = lowConfidence
      ? "LOW_ANPR_CONFIDENCE"
      : vehicle
        ? passCheck.reason
        : "UNKNOWN_VEHICLE";

    const pendingRequest = await prisma.vehicleAccessRequest.create({
      data: {
        siteId,
        gateId: gate.id,
        plateNumber: parsed.data.plateNumber.trim().toUpperCase(),
        normalizedPlateNumber,
        direction,
        confidence: parsed.data.confidence ?? null,
        snapshotUrl: parsed.data.snapshotUrl ?? null,
        status: "PENDING",
        reason: requestReason
      },
      include: {
        gate: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    await prisma.vehicleAccessEvent.create({
      data: {
        siteId,
        organizationId: vehicle?.permanentPass.organizationId ?? null,
        authorizedVehicleId: vehicle?.id ?? null,
        permanentPassId: vehicle?.permanentPass.id ?? null,
        gateId: gate.id,
        gateAccessDeviceId: device.id,
        vehicleAccessRequestId: pendingRequest.id,
        deviceRequestId: parsed.data.requestId ?? null,
        plateNumber: parsed.data.plateNumber.trim().toUpperCase(),
        normalizedPlateNumber,
        direction,
        decision: "UNKNOWN",
        action: "KEEP_LOCKED",
        confidence: parsed.data.confidence ?? null,
        reason: requestReason,
        metadata: {
          gateDeviceId: device.id,
          gateDeviceName: device.name
        }
      }
    });

    await prisma.gateAccessDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: now }
    });

    return response.status(202).json({
      decision: "UNKNOWN",
      action: "KEEP_LOCKED",
      reason: requestReason,
      requestId: pendingRequest.id,
      requiresSecurityApproval: true,
      gate: pendingRequest.gate
    });
  } catch (error) {
    return next(error);
  }
});

vehicleAccessRouter.get("/vehicles", requireBuilding, async (_request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const vehicles = await prisma.authorizedVehicle.findMany({
      where: {
        siteId: user.siteId!
      },
      include: {
        permanentPass: {
          select: {
            id: true,
            passNumber: true,
            fullName: true,
            staffNumber: true,
            status: true,
            organization: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return response.status(200).json({
      data: vehicles.map((vehicle) => ({
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        normalizedPlateNumber: vehicle.normalizedPlateNumber,
        isActive: vehicle.isActive,
        isCurrentlyInside: vehicle.isCurrentlyInside,
        lastEntryAt: vehicle.lastEntryAt?.toISOString() ?? null,
        lastExitAt: vehicle.lastExitAt?.toISOString() ?? null,
        holder: vehicle.permanentPass,
        organization: vehicle.permanentPass.organization
      }))
    });
  } catch (error) {
    return next(error);
  }
});

vehicleAccessRouter.get("/requests", requireBuilding, async (_request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const requests = await prisma.vehicleAccessRequest.findMany({
      where: {
        siteId: user.siteId!,
        status: "PENDING"
      },
      include: {
        gate: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      },
      orderBy: {
        detectedAt: "desc"
      },
      take: 100
    });

    return response.status(200).json({
      data: requests.map((item) => ({
        ...item,
        detectedAt: item.detectedAt.toISOString(),
        reviewedAt: item.reviewedAt?.toISOString() ?? null
      }))
    });
  } catch (error) {
    return next(error);
  }
});

vehicleAccessRouter.get("/events", requireBuilding, async (request, response, next) => {
  try {
    const parsed = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(50)
    }).safeParse(request.query);

    if (!parsed.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid vehicle event pagination."
        }
      });
    }

    const user = response.locals.authUser as AuthUser;
    const { page, pageSize } = parsed.data;

    const [events, total] = await Promise.all([
      prisma.vehicleAccessEvent.findMany({
        where: {
          siteId: user.siteId!
        },
        include: {
          gate: {
            select: {
              name: true
            }
          },
          permanentPass: {
            select: {
              fullName: true,
              organization: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          occurredAt: "desc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.vehicleAccessEvent.count({
        where: {
          siteId: user.siteId!
        }
      })
    ]);

    return response.status(200).json({
      data: events.map((event) => ({
        id: event.id,
        plateNumber: event.plateNumber,
        direction: event.direction,
        decision: event.decision,
        action: event.action,
        reason: event.reason,
        confidence: event.confidence,
        occurredAt: event.occurredAt.toISOString(),
        holderName: event.permanentPass?.fullName ?? null,
        organizationName: event.permanentPass?.organization.name ?? null,
        gateName: event.gate?.name ?? null
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    return next(error);
  }
});

async function reviewVehicleRequest(
  request: any,
  response: any,
  next: any,
  decision: "APPROVED" | "DENIED"
) {
  try {
    const id = z.string().uuid().safeParse(request.params.requestId);
    if (!id.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "A valid vehicle request ID is required."
        }
      });
    }

    const user = response.locals.authUser as AuthUser;
    const pending = await prisma.vehicleAccessRequest.findFirst({
      where: {
        id: id.data,
        siteId: user.siteId!,
        status: "PENDING"
      },
      include: {
        gate: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    if (!pending) {
      return response.status(404).json({
        error: {
          code: "VEHICLE_REQUEST_NOT_FOUND",
          message: "Pending vehicle access request was not found."
        }
      });
    }

    const now = new Date();
    const action = decision === "APPROVED" ? "UNLOCK" : "KEEP_LOCKED";

    const detectionEvent = await prisma.vehicleAccessEvent.findFirst({
      where: {
        siteId: user.siteId!,
        vehicleAccessRequestId: pending.id,
        gateAccessDeviceId: { not: null }
      },
      orderBy: { occurredAt: "asc" }
    });

    if (decision === "APPROVED") {
      if (!detectionEvent?.gateAccessDeviceId) {
        return response.status(409).json({
          error: {
            code: "GATE_DEVICE_UNAVAILABLE",
            message: "The originating gate device is unavailable; the gate remains locked."
          }
        });
      }

      const liveDevice = await prisma.gateAccessDevice.findFirst({
        where: {
          id: detectionEvent.gateAccessDeviceId,
          siteId: user.siteId!,
          gateId: pending.gateId,
          isActive: true,
          site: { isActive: true, status: "ACTIVE" },
          gate: { isActive: true, status: "ONLINE" }
        },
        select: { id: true }
      });

      if (!liveDevice) {
        return response.status(409).json({
          error: {
            code: "GATE_DEVICE_UNAVAILABLE",
            message: "The gate or originating device is no longer available; the gate remains locked."
          }
        });
      }

      if (now.getTime() - pending.detectedAt.getTime() > 120_000) {
        await prisma.vehicleAccessRequest.update({
          where: { id: pending.id },
          data: { status: "EXPIRED", reviewedAt: now, reviewedBy: user.username }
        });
        return response.status(409).json({
          error: {
            code: "VEHICLE_REQUEST_EXPIRED",
            message: "This vehicle arrival is too old to unlock safely. A new ANPR detection is required."
          }
        });
      }
    }

    const updated = await prisma.$transaction(async (transaction) => {
      const reviewed = await transaction.vehicleAccessRequest.update({
        where: { id: pending.id },
        data: {
          status: decision === "APPROVED" ? "APPROVED" : "DENIED",
          reviewedAt: now,
          reviewedBy: user.username
        },
        include: {
          gate: {
            select: {
              id: true,
              code: true,
              name: true
            }
          }
        }
      });

      await transaction.vehicleAccessEvent.create({
        data: {
          siteId: user.siteId!,
          gateId: pending.gateId,
          gateAccessDeviceId: detectionEvent?.gateAccessDeviceId ?? null,
          vehicleAccessRequestId: pending.id,
          plateNumber: pending.plateNumber,
          normalizedPlateNumber: pending.normalizedPlateNumber,
          direction: pending.direction,
          decision,
          action,
          confidence: pending.confidence,
          reason: decision === "APPROVED" ? "SECURITY_APPROVED" : "SECURITY_DENIED",
          approvedBy: user.username,
          metadata: decision === "APPROVED"
            ? commandMetadata({
                source: "SECURITY_APPROVAL",
                reviewedBy: user.username,
                vehicleAccessRequestId: pending.id
              }, "PENDING")
            : { source: "SECURITY_DENIAL", reviewedBy: user.username }
        }
      });

      return reviewed;
    });

    return response.status(200).json({
      data: {
        ...updated,
        detectedAt: updated.detectedAt.toISOString(),
        reviewedAt: updated.reviewedAt?.toISOString() ?? null
      },
      decision,
      action
    });
  } catch (error) {
    next(error);
  }
}

vehicleAccessRouter.post(
  "/requests/:requestId/approve",
  requireBuilding,
  (request, response, next) =>
    reviewVehicleRequest(request, response, next, "APPROVED")
);

vehicleAccessRouter.post(
  "/requests/:requestId/deny",
  requireBuilding,
  (request, response, next) =>
    reviewVehicleRequest(request, response, next, "DENIED")
);


vehicleAccessRouter.get("/gate-command", async (request, response, next) => {
  try {
    const device = await authenticateGateDevice(request);
    if (!device) {
      return response.status(401).json({
        error: { code: "UNAUTHORIZED_GATE_DEVICE", message: "A valid gate device credential is required." }
      });
    }

    const since = new Date(Date.now() - 60_000);
    const candidates = await prisma.vehicleAccessEvent.findMany({
      where: {
        siteId: device.siteId,
        gateId: device.gateId,
        gateAccessDeviceId: device.id,
        action: "UNLOCK",
        occurredAt: { gte: since }
      },
      orderBy: { occurredAt: "asc" },
      take: 20
    });

    const now = Date.now();
    const pending = candidates.find((event) => {
      const metadata = (event.metadata ?? {}) as any;
      const command = metadata.gateCommand;
      return command?.status === "PENDING" &&
        typeof command.expiresAt === "string" &&
        new Date(command.expiresAt).getTime() > now;
    });

    await prisma.gateAccessDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() }
    });

    if (!pending) {
      return response.status(200).json({ command: null });
    }

    const metadata = (pending.metadata ?? {}) as any;
    return response.status(200).json({
      command: {
        id: pending.id,
        type: "UNLOCK",
        gateId: pending.gateId,
        plateNumber: pending.plateNumber,
        direction: pending.direction,
        expiresAt: metadata.gateCommand.expiresAt
      }
    });
  } catch (error) {
    return next(error);
  }
});

vehicleAccessRouter.post("/gate-command/:eventId/ack", async (request, response, next) => {
  try {
    const device = await authenticateGateDevice(request);
    if (!device) {
      return response.status(401).json({
        error: { code: "UNAUTHORIZED_GATE_DEVICE", message: "A valid gate device credential is required." }
      });
    }

    const eventId = z.string().uuid().safeParse(request.params.eventId);
    const parsed = z.object({
      status: z.enum(["ACKNOWLEDGED", "FAILED"]),
      detail: z.string().trim().max(500).optional()
    }).safeParse(request.body);

    if (!eventId.success || !parsed.success) {
      return response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "A valid command ID and acknowledgement status are required." }
      });
    }

    const event = await prisma.vehicleAccessEvent.findFirst({
      where: {
        id: eventId.data,
        siteId: device.siteId,
        gateId: device.gateId,
        gateAccessDeviceId: device.id,
        action: "UNLOCK"
      }
    });

    if (!event) {
      return response.status(404).json({
        error: { code: "GATE_COMMAND_NOT_FOUND", message: "Gate command was not found for this device." }
      });
    }

    const metadata = (event.metadata ?? {}) as any;
    const command = metadata.gateCommand;
    if (!command) {
      return response.status(409).json({
        error: { code: "NOT_A_GATE_COMMAND", message: "This event does not contain a gate command." }
      });
    }

    const updatedMetadata = {
      ...metadata,
      gateCommand: {
        ...command,
        status: parsed.data.status,
        acknowledgedAt: new Date().toISOString(),
        detail: parsed.data.detail ?? null
      }
    };

    await prisma.$transaction([
      prisma.vehicleAccessEvent.update({
        where: { id: event.id },
        data: { metadata: updatedMetadata }
      }),
      prisma.gateAccessDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() }
      })
    ]);

    return response.status(200).json({
      success: true,
      commandId: event.id,
      status: parsed.data.status
    });
  } catch (error) {
    return next(error);
  }
});
