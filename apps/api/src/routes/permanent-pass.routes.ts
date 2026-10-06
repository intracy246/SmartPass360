import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireBuilding, type AuthUser } from "../middleware/auth.middleware";

export const permanentPassRouter = Router();

const holderTypes = [
  "EMPLOYEE",
  "SECURITY",
  "CLEANER",
  "CONTRACTOR",
  "TENANT",
  "VENDOR",
  "OTHER"
] as const;

const statuses = [
  "ACTIVE",
  "SUSPENDED",
  "EXPIRED",
  "REVOKED"
] as const;

const expiryTypes = [
  "LIFETIME",
  "FIXED_DATE"
] as const;

const createSchema = z
  .object({
    organizationId: z.string().uuid(),
    fullName: z.string().trim().min(2).max(200),
    staffNumber: z.string().trim().max(100).optional(),
    department: z.string().trim().min(1).max(200),
    position: z.string().trim().max(200).optional(),
    holderType: z.enum(holderTypes),
    phone: z.string().trim().max(50).optional(),
    email: z.string().trim().email().max(320).optional(),
    photoDataUrl: z.string().max(900_000).optional(),
    vehiclePlateNumber: z.string().trim().max(30).optional(),
    validFrom: z.string().min(1),
    expiryType: z.enum(expiryTypes),
    expiresAt: z.string().optional()
  })
  .superRefine((value, context) => {
    if (value.expiryType === "FIXED_DATE" && !value.expiresAt) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "expiresAt is required for a fixed-date pass"
      });
    }
  });

const updateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(200).optional(),
    staffNumber: z.string().trim().max(100).nullable().optional(),
    department: z.string().trim().min(1).max(200).optional(),
    position: z.string().trim().max(200).nullable().optional(),
    holderType: z.enum(holderTypes).optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    email: z.union([z.string().trim().email().max(320), z.literal("")]).nullable().optional(),
    vehiclePlateNumber: z.string().trim().max(30).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one permanent pass field must be provided."
  });

const querySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(statuses).optional(),
  holderType: z.enum(holderTypes).optional(),
  organizationId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const statusSchema = z.object({
  status: z.enum(statuses),
  reason: z.string().trim().max(500).optional()
});

const replaceSchema = z.object({
  reason: z.string().trim().min(1).max(500)
});

function createQrToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashQrToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createPassNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `SPP-${timestamp}-${random}`;
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePlateNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function serializeVehicle(vehicle: any) {
  if (!vehicle) return null;
  return {
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    normalizedPlateNumber: vehicle.normalizedPlateNumber,
    isActive: vehicle.isActive,
    isCurrentlyInside: vehicle.isCurrentlyInside,
    lastEntryAt: vehicle.lastEntryAt?.toISOString?.() ?? null,
    lastExitAt: vehicle.lastExitAt?.toISOString?.() ?? null
  };
}

function serializePermanentPass(pass: any, qrToken?: string) {
  const vehicle = Array.isArray(pass.authorizedVehicles)
    ? pass.authorizedVehicles[0] ?? null
    : null;

  return {
    id: pass.id,
    organizationId: pass.organizationId,
    organizationName: pass.organization?.name ?? null,
    passNumber: pass.passNumber,
    qrToken: qrToken ?? null,
    qrCodeUrl: qrToken ? `smartpass360://permanent-pass/${qrToken}` : null,
    fullName: pass.fullName,
    staffNumber: pass.staffNumber,
    department: pass.department,
    position: pass.position,
    holderType: pass.holderType,
    status: pass.status,
    phone: pass.phone,
    email: pass.email,
    photoUrl: pass.photoUrl,
    vehicle: serializeVehicle(vehicle),
    validFrom: pass.validFrom.toISOString(),
    expiryType: pass.expiryType,
    expiresAt: pass.expiresAt?.toISOString() ?? null,
    isCurrentlyInside: pass.isCurrentlyInside,
    lastActivityType: pass.lastActivityType,
    lastActivityAt: pass.lastActivityAt?.toISOString() ?? null,
    createdAt: pass.createdAt.toISOString(),
    updatedAt: pass.updatedAt.toISOString()
  };
}

function validationError(response: any, details: unknown) {
  return response.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "Invalid request data.",
      details
    }
  });
}

function buildingPassWhere(siteId: string, permanentPassId?: string) {
  return {
    ...(permanentPassId ? { id: permanentPassId } : {}),
    organization: {
      siteOrganizations: {
        some: {
          siteId,
          isActive: true
        }
      }
    }
  };
}

async function validateBuildingOrganization(siteId: string, organizationId: string) {
  return prisma.siteOrganization.findFirst({
    where: {
      siteId,
      organizationId,
      isActive: true,
      site: {
        isActive: true,
        status: "ACTIVE"
      },
      organization: {
        isActive: true
      }
    },
    select: {
      organizationId: true
    }
  });
}

function vehicleInclude() {
  return {
    organization: {
      select: {
        name: true
      }
    },
    authorizedVehicles: {
      where: {
        isActive: true
      },
      orderBy: {
        createdAt: "asc" as const
      },
      take: 1
    }
  };
}

permanentPassRouter.use(requireBuilding);

permanentPassRouter.get("/", async (request, response, next) => {
  try {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return validationError(response, parsed.error.flatten());

    const user = response.locals.authUser as AuthUser;
    const { search, status, holderType, organizationId, page, pageSize } = parsed.data;

    if (organizationId) {
      const allowedOrganization = await validateBuildingOrganization(user.siteId!, organizationId);
      if (!allowedOrganization) {
        return response.status(403).json({
          error: {
            code: "INVALID_ORGANIZATION",
            message: "The selected organization does not belong to this building."
          }
        });
      }
    }

    const where: any = {
      ...buildingPassWhere(user.siteId!),
      ...(organizationId ? { organizationId } : {}),
      ...(status ? { status } : {}),
      ...(holderType ? { holderType } : {})
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { passNumber: { contains: search, mode: "insensitive" } },
        { staffNumber: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } },
        {
          authorizedVehicles: {
            some: {
              normalizedPlateNumber: {
                contains: normalizePlateNumber(search)
              }
            }
          }
        }
      ];
    }

    const skip = (page - 1) * pageSize;
    const [passes, total] = await prisma.$transaction([
      prisma.permanentPass.findMany({
        where,
        include: vehicleInclude(),
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      prisma.permanentPass.count({ where })
    ]);

    return response.status(200).json({
      data: passes.map((pass) => serializePermanentPass(pass)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    next(error);
  }
});

permanentPassRouter.get("/:permanentPassId", async (request, response, next) => {
  try {
    const permanentPassId = z.string().uuid().safeParse(request.params.permanentPassId);
    if (!permanentPassId.success) return validationError(response, permanentPassId.error.flatten());

    const user = response.locals.authUser as AuthUser;
    const pass = await prisma.permanentPass.findFirst({
      where: buildingPassWhere(user.siteId!, permanentPassId.data),
      include: vehicleInclude()
    });

    if (!pass) {
      return response.status(404).json({
        error: {
          code: "PERMANENT_PASS_NOT_FOUND",
          message: "Permanent pass was not found."
        }
      });
    }

    return response.status(200).json(serializePermanentPass(pass));
  } catch (error) {
    next(error);
  }
});

permanentPassRouter.post("/", async (request, response, next) => {
  try {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error.flatten());

    const user = response.locals.authUser as AuthUser;
    const input = parsed.data;

    const allowedOrganization = await validateBuildingOrganization(user.siteId!, input.organizationId);
    if (!allowedOrganization) {
      return response.status(403).json({
        error: {
          code: "INVALID_ORGANIZATION",
          message: "The selected organization does not belong to this building or is inactive."
        }
      });
    }

    const validFrom = parseDate(input.validFrom);
    if (!validFrom) {
      return validationError(response, {
        validFrom: ["validFrom must be a valid date."]
      });
    }

    let expiresAt: Date | null = null;
    if (input.expiryType === "FIXED_DATE" && input.expiresAt) {
      expiresAt = parseDate(input.expiresAt);
      if (!expiresAt) {
        return validationError(response, {
          expiresAt: ["expiresAt must be a valid date."]
        });
      }
      if (expiresAt.getTime() <= validFrom.getTime()) {
        return validationError(response, {
          expiresAt: ["expiresAt must be later than validFrom."]
        });
      }
    }

    const normalizedPlateNumber = input.vehiclePlateNumber
      ? normalizePlateNumber(input.vehiclePlateNumber)
      : null;

    if (input.vehiclePlateNumber && normalizedPlateNumber!.length < 4) {
      return validationError(response, {
        vehiclePlateNumber: ["Enter a valid vehicle plate number."]
      });
    }

    const qrToken = createQrToken();

    const pass = await prisma.$transaction(async (transaction) => {
      const createdPass = await transaction.permanentPass.create({
        data: {
          organizationId: input.organizationId,
          passNumber: createPassNumber(),
          qrTokenHash: hashQrToken(qrToken),
          fullName: input.fullName,
          staffNumber: input.staffNumber || null,
          department: input.department,
          position: input.position || null,
          holderType: input.holderType,
          phone: input.phone || null,
          email: input.email || null,
          photoUrl: input.photoDataUrl || null,
          validFrom,
          expiryType: input.expiryType,
          expiresAt
        }
      });

      if (normalizedPlateNumber) {
        await transaction.authorizedVehicle.create({
          data: {
            siteId: user.siteId!,
            permanentPassId: createdPass.id,
            plateNumber: input.vehiclePlateNumber!.trim().toUpperCase(),
            normalizedPlateNumber
          }
        });
      }

      return transaction.permanentPass.findUniqueOrThrow({
        where: { id: createdPass.id },
        include: vehicleInclude()
      });
    });

    return response.status(201).json({
      data: serializePermanentPass(pass, qrToken),
      message: "Permanent pass created successfully."
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return response.status(409).json({
        error: {
          code: "VEHICLE_PLATE_ALREADY_REGISTERED",
          message: "This vehicle plate is already registered for this building."
        }
      });
    }
    next(error);
  }
});

permanentPassRouter.patch("/:permanentPassId", async (request, response, next) => {
  try {
    const permanentPassId = z.string().uuid().safeParse(request.params.permanentPassId);
    if (!permanentPassId.success) return validationError(response, permanentPassId.error.flatten());

    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error.flatten());

    const user = response.locals.authUser as AuthUser;
    const existing = await prisma.permanentPass.findFirst({
      where: buildingPassWhere(user.siteId!, permanentPassId.data),
      include: {
        authorizedVehicles: {
          orderBy: { createdAt: "asc" },
          take: 1
        }
      }
    });

    if (!existing) {
      return response.status(404).json({
        error: {
          code: "PERMANENT_PASS_NOT_FOUND",
          message: "Permanent pass was not found."
        }
      });
    }

    const input = parsed.data;

    let normalizedPlateNumber: string | null | undefined = undefined;
    if (input.vehiclePlateNumber !== undefined) {
      normalizedPlateNumber = input.vehiclePlateNumber
        ? normalizePlateNumber(input.vehiclePlateNumber)
        : null;

      if (input.vehiclePlateNumber && normalizedPlateNumber.length < 4) {
        return validationError(response, {
          vehiclePlateNumber: ["Enter a valid vehicle plate number."]
        });
      }
    }

    const pass = await prisma.$transaction(async (transaction) => {
      await transaction.permanentPass.update({
        where: { id: existing.id },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.staffNumber !== undefined ? { staffNumber: input.staffNumber?.trim() || null } : {}),
          ...(input.department !== undefined ? { department: input.department } : {}),
          ...(input.position !== undefined ? { position: input.position?.trim() || null } : {}),
          ...(input.holderType !== undefined ? { holderType: input.holderType } : {}),
          ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
          ...(input.email !== undefined ? { email: input.email?.trim() || null } : {})
        }
      });

      if (normalizedPlateNumber !== undefined) {
        const currentVehicle = existing.authorizedVehicles[0] ?? null;

        if (normalizedPlateNumber === null) {
          if (currentVehicle) {
            await transaction.authorizedVehicle.update({
              where: { id: currentVehicle.id },
              data: { isActive: false }
            });
          }
        } else if (currentVehicle) {
          await transaction.authorizedVehicle.update({
            where: { id: currentVehicle.id },
            data: {
              plateNumber: input.vehiclePlateNumber!.trim().toUpperCase(),
              normalizedPlateNumber,
              isActive: true
            }
          });
        } else {
          await transaction.authorizedVehicle.create({
            data: {
              siteId: user.siteId!,
              permanentPassId: existing.id,
              plateNumber: input.vehiclePlateNumber!.trim().toUpperCase(),
              normalizedPlateNumber
            }
          });
        }
      }

      return transaction.permanentPass.findUniqueOrThrow({
        where: { id: existing.id },
        include: vehicleInclude()
      });
    });

    return response.status(200).json({
      data: serializePermanentPass(pass),
      message: "Permanent pass updated successfully."
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return response.status(409).json({
        error: {
          code: "VEHICLE_PLATE_ALREADY_REGISTERED",
          message: "This vehicle plate is already registered for this building."
        }
      });
    }
    next(error);
  }
});

permanentPassRouter.patch("/:permanentPassId/status", async (request, response, next) => {
  try {
    const permanentPassId = z.string().uuid().safeParse(request.params.permanentPassId);
    const parsed = statusSchema.safeParse(request.body);

    if (!permanentPassId.success) return validationError(response, permanentPassId.error.flatten());
    if (!parsed.success) return validationError(response, parsed.error.flatten());

    const user = response.locals.authUser as AuthUser;
    const existing = await prisma.permanentPass.findFirst({
      where: buildingPassWhere(user.siteId!, permanentPassId.data),
      select: { id: true }
    });

    if (!existing) {
      return response.status(404).json({
        error: {
          code: "PERMANENT_PASS_NOT_FOUND",
          message: "Permanent pass was not found."
        }
      });
    }

    const pass = await prisma.permanentPass.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        revokedAt: parsed.data.status === "REVOKED" ? new Date() : null,
        revocationReason: parsed.data.status === "REVOKED" ? parsed.data.reason || null : null
      },
      include: vehicleInclude()
    });

    return response.status(200).json(serializePermanentPass(pass));
  } catch (error) {
    next(error);
  }
});

permanentPassRouter.post("/:permanentPassId/replace", async (request, response, next) => {
  try {
    const permanentPassId = z.string().uuid().safeParse(request.params.permanentPassId);
    const parsed = replaceSchema.safeParse(request.body);

    if (!permanentPassId.success) return validationError(response, permanentPassId.error.flatten());
    if (!parsed.success) return validationError(response, parsed.error.flatten());

    const user = response.locals.authUser as AuthUser;
    const existing = await prisma.permanentPass.findFirst({
      where: buildingPassWhere(user.siteId!, permanentPassId.data)
    });

    if (!existing) {
      return response.status(404).json({
        error: {
          code: "PERMANENT_PASS_NOT_FOUND",
          message: "Permanent pass was not found."
        }
      });
    }

    if (existing.status === "REVOKED") {
      return response.status(409).json({
        error: {
          code: "PERMANENT_PASS_REVOKED",
          message: "A revoked permanent pass cannot be replaced."
        }
      });
    }

    const qrToken = createQrToken();
    const pass = await prisma.permanentPass.update({
      where: { id: existing.id },
      data: { qrTokenHash: hashQrToken(qrToken) },
      include: vehicleInclude()
    });

    return response.status(200).json({
      data: serializePermanentPass(pass, qrToken),
      message: "Permanent pass QR replaced successfully."
    });
  } catch (error) {
    next(error);
  }
});
