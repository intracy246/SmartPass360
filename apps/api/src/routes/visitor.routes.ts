import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireBuilding, type AuthUser } from "../middleware/auth.middleware";

export const visitorRouter = Router();

const idTypeSchema = z.enum([
  "NATIONAL_ID",
  "PASSPORT",
  "DRIVING_LICENCE",
  "VOTER_ID",
  "OTHER",
  "NONE"
]);

const kioskRegistrationSchema = z.object({
  kioskId: z.string().uuid(),
  organizationId: z.string().uuid(),
  fullName: z.string().trim().min(3).max(200),
  phoneNumber: z.string().trim().min(7).max(40),
  identificationType: idTypeSchema.default("NONE"),
  identificationNumber: z.string().trim().max(200).optional(),
  companyName: z.string().trim().max(200).optional(),
  vehicleRegistrationNumber: z.string().trim().max(80).optional(),
  departmentOrOffice: z.string().trim().max(200).optional(),
  hostName: z.string().trim().max(200).optional(),
  purposeOfVisit: z.string().trim().max(1000).optional(),
  source: z.literal("KIOSK")
});

const receptionRegistrationSchema = z.object({
  organizationId: z.string().uuid(),
  fullName: z.string().trim().min(3).max(200),
  phoneNumber: z.string().trim().min(7).max(40).optional(),
  identificationType: idTypeSchema.default("NONE"),
  identificationNumber: z.string().trim().max(200).optional(),
  companyName: z.string().trim().max(200).optional(),
  vehicleRegistrationNumber: z.string().trim().max(80).optional(),
  departmentOrOffice: z.string().trim().max(200).optional(),
  hostName: z.string().trim().max(200).optional(),
  purposeOfVisit: z.string().trim().max(1000).optional()
});

async function organizationBelongsToSite(siteId: string, organizationId: string) {
  const link = await prisma.siteOrganization.findFirst({
    where: {
      siteId,
      organizationId,
      isActive: true,
      organization: { isActive: true }
    },
    select: { id: true }
  });
  return Boolean(link);
}

async function createVisit(input: {
  organizationId: string;
  fullName: string;
  phoneNumber?: string;
  identificationType: string;
  identificationNumber?: string;
  companyName?: string;
  vehicleRegistrationNumber?: string;
  departmentOrOffice?: string;
  hostName?: string;
  purposeOfVisit?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const visitor = await tx.visitor.create({
      data: {
        organizationId: input.organizationId,
        fullName: input.fullName,
        idType: input.identificationType === "NONE" ? undefined : input.identificationType,
        idNumberEncrypted: input.identificationNumber || undefined,
        phone: input.phoneNumber || undefined,
        company: input.companyName || undefined,
        vehicleNumber: input.vehicleRegistrationNumber || undefined
      }
    });

    const visit = await tx.visitRequest.create({
      data: {
        organizationId: input.organizationId,
        visitorId: visitor.id,
        visitorType: "WALK_IN",
        purpose: input.purposeOfVisit || "",
        destinationOffice: input.departmentOrOffice || undefined,
        hostNameSnapshot: input.hostName || undefined,
        approvalRequired: true,
        status: "PENDING_APPROVAL"
      }
    });

    return { visitor, visit };
  });
}

visitorRouter.post("/kiosk-registration", async (request, response, next) => {
  try {
    const parsed = kioskRegistrationSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid visitor registration data.",
          details: parsed.error.flatten()
        }
      });
    }

    const kiosk = await prisma.kiosk.findUnique({
      where: { id: parsed.data.kioskId },
      include: { site: true }
    });

    if (!kiosk || !kiosk.isActive || !kiosk.site.isActive) {
      return response.status(404).json({
        error: { code: "KIOSK_NOT_AVAILABLE", message: "Kiosk is unavailable." }
      });
    }

    if (!(await organizationBelongsToSite(kiosk.siteId, parsed.data.organizationId))) {
      return response.status(403).json({
        error: { code: "INVALID_ORGANIZATION", message: "Selected organization does not belong to this building." }
      });
    }

    const { visitor, visit } = await createVisit(parsed.data);
    return response.status(201).json({
      success: true,
      data: {
        visitorId: visitor.id,
        visitId: visit.id,
        referenceNumber: visit.id.slice(0, 8).toUpperCase(),
        status: "WAITING_APPROVAL",
        registeredAt: visit.createdAt
      }
    });
  } catch (error) {
    return next(error);
  }
});

visitorRouter.post("/register", requireBuilding, async (request, response, next) => {
  try {
    const parsed = receptionRegistrationSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid visitor registration data.",
          details: parsed.error.flatten()
        }
      });
    }

    const user = response.locals.authUser as AuthUser;
    if (!(await organizationBelongsToSite(user.siteId!, parsed.data.organizationId))) {
      return response.status(403).json({
        error: { code: "INVALID_ORGANIZATION", message: "Selected organization does not belong to your building." }
      });
    }

    const { visitor, visit } = await createVisit(parsed.data);
    return response.status(201).json({
      success: true,
      data: {
        visitorId: visitor.id,
        visitId: visit.id,
        status: visit.status
      }
    });
  } catch (error) {
    return next(error);
  }
});
