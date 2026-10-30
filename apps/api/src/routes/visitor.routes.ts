import crypto from "node:crypto";
import { Router, type RequestHandler } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { requireBuilding, type AuthUser } from "../middleware/auth.middleware.js";
import {
  activeMembership,
  getActivatedKiosk,
  hashToken,
  issueVisitorPass,
  publicVisit,
  visitorPassQrValue,
  visitorPassTokenForReceiptHash,
  visitInclude
} from "../lib/visitor-workflow.js";

const reportPeriodSchema = z.enum(["today", "week", "month"]);
type ReportPeriod = z.infer<typeof reportPeriodSchema>;

function darEsSalaamDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  };
}

function dateStringUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function addCalendarDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  return dateStringUtc(year, month, day + days);
}

function reportDateRange(period: ReportPeriod, now = new Date()) {
  const local = darEsSalaamDateParts(now);
  const today = dateStringUtc(local.year, local.month, local.day);
  let startDate: string;
  let endDate: string;

  if (period === "today") {
    startDate = today;
    endDate = addCalendarDays(today, 1);
  } else if (period === "week") {
    const date = new Date(`${today}T00:00:00.000Z`);
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    startDate = addCalendarDays(today, -daysSinceMonday);
    endDate = addCalendarDays(startDate, 7);
  } else {
    startDate = dateStringUtc(local.year, local.month, 1);
    endDate = local.month === 12
      ? dateStringUtc(local.year + 1, 1, 1)
      : dateStringUtc(local.year, local.month + 1, 1);
  }

  // Tanzania has UTC+03:00 year-round. Use local calendar boundaries so
  // the daily list rolls over at midnight in Dar es Salaam, not at UTC midnight.
  return {
    gte: new Date(`${startDate}T00:00:00.000+03:00`),
    lt: new Date(`${endDate}T00:00:00.000+03:00`)
  };
}


const publicRegistrationSchema = z.object({
  kioskId: z.string().uuid(),
  organizationId: z.string().uuid(),
  fullName: z.string().trim().min(3).max(200),
  phoneNumber: z.string().trim().min(7).max(40),
  identificationType: z.enum(["NATIONAL_ID", "PASSPORT", "DRIVING_LICENCE", "VOTER_ID", "OTHER", "NONE"]).default("NONE"),
  identificationNumber: z.string().trim().max(200).optional(),
  companyName: z.string().trim().max(200).optional(),
  vehicleRegistrationNumber: z.string().trim().max(80).optional(),
  departmentOrOffice: z.string().trim().max(200).optional(),
  hostName: z.string().trim().max(200).optional(),
  purposeOfVisit: z.string().trim().max(1000).optional()
}).superRefine((value, context) => {
  if (value.identificationType !== "NONE" && !value.identificationNumber?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["identificationNumber"],
      message: "Identification number is required for the selected identification type."
    });
  }
});

const publicRegistrationStatusSchema = z.object({
  kioskId: z.string().uuid(),
  visitId: z.string().uuid(),
  receiptToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/)
});

function createPublicRateLimit(maxRequests: number, windowMs: number): RequestHandler {
  const requests = new Map<string, { count: number; resetAt: number }>();

  return (request, response, next) => {
    const now = Date.now();
    const forwardedIp = request.get("cf-connecting-ip")?.split(",")[0]?.trim();
    const clientIp = forwardedIp || request.ip || request.socket.remoteAddress || "unknown";
    let bucket = requests.get(clientIp);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      requests.set(clientIp, bucket);
    }

    if (bucket.count >= maxRequests) {
      response.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return response.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please wait a few minutes and try again."
        }
      });
    }

    bucket.count += 1;

    if (requests.size > 5000) {
      for (const [ip, item] of requests) {
        if (item.resetAt <= now) requests.delete(ip);
      }
    }

    return next();
  };
}

const publicRegistrationRateLimit = createPublicRateLimit(8, 15 * 60 * 1000);
const publicStatusRateLimit = createPublicRateLimit(120, 15 * 60 * 1000);

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
  phoneNumber: z.string().trim().min(7).max(40),
  identificationType: idTypeSchema.default("NONE"),
  identificationNumber: z.string().trim().max(200).optional(),
  companyName: z.string().trim().max(200).optional(),
  vehicleRegistrationNumber: z.string().trim().max(80).optional(),
  departmentOrOffice: z.string().trim().max(200).optional(),
  hostName: z.string().trim().max(200).optional(),
  purposeOfVisit: z.string().trim().max(1000).optional()
}).superRefine((value, context) => {
  if (
    value.identificationType !== "NONE" &&
    !value.identificationNumber?.trim()
  ) {
    context.addIssue({
      code: "custom",
      path: ["identificationNumber"],
      message: "Identification number is required for the selected identification type."
    });
  }
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
  siteId: string;
  kioskId?: string;
  source: "KIOSK" | "RECEPTION";
  receiptToken?: string;
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
        siteId: input.siteId,
        kioskId: input.kioskId,
        source: input.source,
        kioskReceiptHash: input.receiptToken ? hashToken(input.receiptToken) : undefined,
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

    const kiosk = await getActivatedKiosk(request, parsed.data.kioskId);

    if (!kiosk) {
      return response.status(403).json({
        error: { code: "KIOSK_NOT_AVAILABLE", message: "Kiosk is unavailable." }
      });
    }

    if (!(await organizationBelongsToSite(kiosk.siteId, parsed.data.organizationId))) {
      return response.status(403).json({
        error: { code: "INVALID_ORGANIZATION", message: "Selected organization does not belong to this building." }
      });
    }

    const receiptToken = crypto.randomBytes(32).toString("base64url");
    const { visitor, visit } = await createVisit({ ...parsed.data, siteId: kiosk.siteId, kioskId: kiosk.id, source: "KIOSK", receiptToken });
    response.setHeader("Cache-Control", "no-store");
    return response.status(201).json({
      success: true,
      data: {
        visitorId: visitor.id,
        visitId: visit.id,
        referenceNumber: visit.id.slice(0, 8).toUpperCase(),
        status: "WAITING_APPROVAL",
        registeredAt: visit.createdAt,
        receiptToken
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
    const token = crypto.randomBytes(32).toString("base64url");
    const qrValue = await (await import("qrcode")).default.toDataURL(
      visitorPassQrValue(token),
      { width: 300, margin: 4, errorCorrectionLevel: "M" }
    );

    const result = await prisma.$transaction(async (tx) => {
      const membership = await tx.siteOrganization.findFirst({
        where: {
          siteId: user.siteId!,
          organizationId: parsed.data.organizationId,
          isActive: true,
          organization: { isActive: true },
          site: { isActive: true, status: "ACTIVE" }
        },
        select: { id: true }
      });

      if (!membership) return null;

      const visitor = await tx.visitor.create({
        data: {
          organizationId: parsed.data.organizationId,
          fullName: parsed.data.fullName,
          idType:
            parsed.data.identificationType === "NONE"
              ? undefined
              : parsed.data.identificationType,
          idNumberEncrypted:
            parsed.data.identificationType === "NONE"
              ? undefined
              : parsed.data.identificationNumber,
          phone: parsed.data.phoneNumber,
          company: parsed.data.companyName,
          vehicleNumber: parsed.data.vehicleRegistrationNumber
        }
      });

      const approvedAt = new Date();
      const visit = await tx.visitRequest.create({
        data: {
          siteId: user.siteId!,
          source: "RECEPTION",
          organizationId: parsed.data.organizationId,
          visitorId: visitor.id,
          visitorType: "WALK_IN",
          purpose: parsed.data.purposeOfVisit ?? "",
          destinationOffice: parsed.data.departmentOrOffice,
          hostNameSnapshot: parsed.data.hostName,
          approvalRequired: false,
          approvedAt,
          status: "APPROVED"
        }
      });

      const { pass } = await issueVisitorPass(tx, {
        visitId: visit.id,
        organizationId: visit.organizationId,
        token,
        validFrom: approvedAt
      });

      return { visitor, visit, pass };
    });

    if (!result) {
      return response.status(403).json({
        error: {
          code: "INVALID_ORGANIZATION",
          message: "Selected organization does not belong to your building or is unavailable."
        }
      });
    }

    return response.status(201).json({
      success: true,
      data: {
        visitorId: result.visitor.id,
        visitId: result.visit.id,
        status: "PASS_ISSUED",
        source: "RECEPTION",
        pass: {
          passNumber: result.pass.passNumber,
          qrValue,
          issuedAt: result.pass.issuedAt,
          validFrom: result.pass.validFrom,
          validUntil: result.pass.validUntil
        }
      }
    });
  } catch (error) {
    return next(error);
  }
});

visitorRouter.post("/self-service/register", publicRegistrationRateLimit, async (request, response, next) => {
  try {
    const parsed = publicRegistrationSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Please check the visitor details and try again.",
          details: parsed.error.flatten()
        }
      });
    }

    const receiptToken = crypto.randomBytes(32).toString("base64url");
    const result = await prisma.$transaction(async (tx) => {
      const kiosk = await tx.kiosk.findFirst({
        where: {
          id: parsed.data.kioskId,
          isActive: true,
          site: { isActive: true, status: "ACTIVE" }
        },
        select: { id: true, siteId: true }
      });
      if (!kiosk) return { kind: "kiosk-unavailable" as const };

      const membership = await tx.siteOrganization.findFirst({
        where: {
          siteId: kiosk.siteId,
          organizationId: parsed.data.organizationId,
          isActive: true,
          organization: { isActive: true },
          site: { isActive: true, status: "ACTIVE" }
        },
        select: { id: true }
      });
      if (!membership) return { kind: "organization-unavailable" as const };

      const visitor = await tx.visitor.create({
        data: {
          organizationId: parsed.data.organizationId,
          fullName: parsed.data.fullName,
          idType: parsed.data.identificationType === "NONE" ? undefined : parsed.data.identificationType,
          idNumberEncrypted: parsed.data.identificationType === "NONE" ? undefined : parsed.data.identificationNumber,
          phone: parsed.data.phoneNumber,
          company: parsed.data.companyName || undefined,
          vehicleNumber: parsed.data.vehicleRegistrationNumber || undefined
        }
      });

      const visit = await tx.visitRequest.create({
        data: {
          siteId: kiosk.siteId,
          kioskId: kiosk.id,
          source: "MOBILE_QR",
          kioskReceiptHash: hashToken(receiptToken),
          organizationId: parsed.data.organizationId,
          visitorId: visitor.id,
          visitorType: "WALK_IN",
          purpose: parsed.data.purposeOfVisit || "",
          destinationOffice: parsed.data.departmentOrOffice || undefined,
          hostNameSnapshot: parsed.data.hostName || undefined,
          approvalRequired: true,
          status: "PENDING_APPROVAL"
        },
        select: { id: true, createdAt: true }
      });

      return { kind: "created" as const, visit };
    });

    if (result.kind === "kiosk-unavailable") {
      return response.status(404).json({
        error: { code: "KIOSK_NOT_AVAILABLE", message: "This kiosk is inactive or no longer accepting registrations." }
      });
    }
    if (result.kind === "organization-unavailable") {
      return response.status(400).json({
        error: { code: "ORGANIZATION_NOT_AVAILABLE", message: "Please select an active organization for this building." }
      });
    }

    response.setHeader("Cache-Control", "no-store");
    return response.status(201).json({
      success: true,
      data: {
        kioskId: parsed.data.kioskId,
        visitId: result.visit.id,
        referenceNumber: result.visit.id.slice(0, 8).toUpperCase(),
        status: "PENDING_APPROVAL",
        registeredAt: result.visit.createdAt,
        receiptToken
      }
    });
  } catch (error) {
    return next(error);
  }
});

visitorRouter.post("/self-service/status", publicStatusRateLimit, async (request, response, next) => {
  try {
    const parsed = publicRegistrationStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid registration receipt." }
      });
    }

    const { kioskId, visitId, receiptToken } = parsed.data;
    const legacyPassToken = crypto.createHmac("sha256", receiptToken)
      .update(`visitor-pass:${visitId}`)
      .digest("base64url");

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM visit_requests WHERE id = ${visitId}::uuid FOR UPDATE`;

      const visit = await tx.visitRequest.findFirst({
        where: {
          id: visitId,
          kioskId,
          source: "MOBILE_QR",
          kioskReceiptHash: hashToken(receiptToken)
        },
        include: { ...visitInclude, pass: true }
      });

      if (!visit) return { kind: "invalid" as const };

      if (visit.status === "REJECTED") {
        return {
          kind: "rejected" as const,
          referenceNumber: visit.id.slice(0, 8).toUpperCase()
        };
      }

      if (!["APPROVED", "PASS_ISSUED"].includes(visit.status) || !visit.approvedAt) {
        return {
          kind: "pending" as const,
          referenceNumber: visit.id.slice(0, 8).toUpperCase()
        };
      }

      const membership = await tx.siteOrganization.findFirst({
        where: {
          siteId: visit.siteId!,
          organizationId: visit.organizationId,
          isActive: true,
          organization: { isActive: true },
          site: { isActive: true, status: "ACTIVE" }
        },
        select: { id: true }
      });

      if (!membership) return { kind: "unavailable" as const };

      const now = new Date();
      const stablePassToken = visitorPassTokenForReceiptHash(visit.id, visit.kioskReceiptHash!);
      let passToken = stablePassToken;
      let pass = visit.pass;

      if (pass) {
        // Preserve passes issued before the stable-token migration; all newly
        // issued passes use the stable token so Security can also print them.
        if (pass.qrTokenHash === hashToken(legacyPassToken)) {
          passToken = legacyPassToken;
        } else if (pass.qrTokenHash !== hashToken(stablePassToken)) {
          return { kind: "unavailable" as const };
        }

        if (pass.status !== "ACTIVE" || pass.validUntil <= now) {
          return { kind: "unavailable" as const };
        }
      } else {
        const issued = await issueVisitorPass(tx, {
          visitId: visit.id,
          organizationId: visit.organizationId,
          token: stablePassToken,
          validFrom: now
        });
        pass = issued.pass;
        passToken = stablePassToken;
      }

      return {
        kind: "issued" as const,
        referenceNumber: visit.id.slice(0, 8).toUpperCase(),
        pass: {
          passNumber: pass.passNumber,
          status: pass.status,
          issuedAt: pass.issuedAt,
          validFrom: pass.validFrom,
          validUntil: pass.validUntil
        },
        visitor: {
          fullName: visit.visitor.fullName,
          organizationName: visit.organization.name,
          siteName: visit.site?.name ?? "SmartPass360",
          departmentOrOffice: visit.destinationOffice,
          hostName: visit.hostNameSnapshot,
          purpose: visit.purpose
        },
        qrValue: visitorPassQrValue(passToken)
      };
    });

    response.setHeader("Cache-Control", "no-store");

    if (result.kind === "invalid") {
      return response.status(404).json({
        error: { code: "RECEIPT_INVALID", message: "This registration could not be verified." }
      });
    }
    if (result.kind === "rejected") {
      return response.status(200).json({
        success: true,
        data: { status: "REJECTED", referenceNumber: result.referenceNumber }
      });
    }
    if (result.kind === "unavailable") {
      return response.status(409).json({
        error: { code: "PASS_NOT_AVAILABLE", message: "The pass is no longer available. Please contact Reception or Security." }
      });
    }
    if (result.kind === "pending") {
      return response.status(200).json({
        success: true,
        data: { status: "PENDING_APPROVAL", referenceNumber: result.referenceNumber }
      });
    }

    return response.status(200).json({
      success: true,
      data: {
        status: "PASS_ISSUED",
        referenceNumber: result.referenceNumber,
        pass: result.pass,
        visitor: result.visitor,
        qrValue: result.qrValue
      }
    });
  } catch (error) {
    return next(error);
  }
});


const intelligentSearchSchema = z.object({
  q: z.string().trim().min(2).max(120)
});

visitorRouter.get("/search", requireBuilding, async (request, response, next) => {
  try {
    const parsed = intelligentSearchSchema.safeParse({ q: request.query.q });
    if (!parsed.success) {
      return response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Enter at least 2 characters to search." }
      });
    }

    const user = response.locals.authUser as AuthUser;
    const siteId = user.siteId!;
    const query = parsed.data.q;
    const normalizedPlate = query.toUpperCase().replace(/[^A-Z0-9]/g, "");

    const [visits, organizations, permanentPasses] = await Promise.all([
      prisma.visitRequest.findMany({
        where: {
          siteId,
          OR: [
            { visitor: { fullName: { contains: query, mode: "insensitive" } } },
            { visitor: { phone: { contains: query, mode: "insensitive" } } },
            { visitor: { email: { contains: query, mode: "insensitive" } } },
            { visitor: { idType: { contains: query, mode: "insensitive" } } },
            { visitor: { idNumberEncrypted: { contains: query, mode: "insensitive" } } },
            { visitor: { company: { contains: query, mode: "insensitive" } } },
            { visitor: { vehicleNumber: { contains: query, mode: "insensitive" } } },
            { destinationOffice: { contains: query, mode: "insensitive" } },
            { hostNameSnapshot: { contains: query, mode: "insensitive" } },
            { purpose: { contains: query, mode: "insensitive" } },
            { organization: { name: { contains: query, mode: "insensitive" } } },
            { organization: { code: { contains: query, mode: "insensitive" } } },
            { pass: { is: { passNumber: { contains: query, mode: "insensitive" } } } }
          ]
        },
        include: visitInclude,
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma.organization.findMany({
        where: {
          isActive: true,
          siteOrganizations: { some: { siteId, isActive: true } },
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { code: { contains: query, mode: "insensitive" } }
          ]
        },
        select: { id: true, name: true, code: true, createdAt: true, updatedAt: true },
        orderBy: { name: "asc" },
        take: 50
      }),
      prisma.organization.findMany({
        where: {
          isActive: true,
          siteOrganizations: { some: { siteId, isActive: true } },
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { code: { contains: query, mode: "insensitive" } }
          ]
        },
        select: { id: true, name: true, code: true, createdAt: true, updatedAt: true },
        orderBy: { name: "asc" },
        take: 50
      }),
      prisma.permanentPass.findMany({
        where: {
          organization: {
            siteOrganizations: { some: { siteId, isActive: true } }
          },
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { staffNumber: { contains: query, mode: "insensitive" } },
            { department: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { passNumber: { contains: query, mode: "insensitive" } },
            { position: { contains: query, mode: "insensitive" } },
            { organization: { name: { contains: query, mode: "insensitive" } } },
            { organization: { code: { contains: query, mode: "insensitive" } } },
            ...(normalizedPlate
              ? [{
                  authorizedVehicles: {
                    some: {
                      normalizedPlateNumber: { contains: normalizedPlate }
                    }
                  }
                }]
              : [])
          ]
        },
        include: {
          organization: { select: { name: true } },
          authorizedVehicles: {
            where: { isActive: true },
            take: 5
          }
        },
        orderBy: { createdAt: "desc" },
        take: 50
      })
    ]);

    const visitorResults = visits.map((visit) => ({
      id: visit.id,
      recordType: "VISITOR" as const,
      fullName: visit.visitor.fullName,
      phone: visit.visitor.phone,
      company: visit.visitor.company,
      vehicleNumber: visit.visitor.vehicleNumber,
      organizationName: visit.organization.name,
      department: visit.destinationOffice,
      hostName: visit.hostNameSnapshot,
      purpose: visit.purpose,
      passNumber: visit.pass?.passNumber ?? null,
      status: visit.status,
      createdAt: visit.createdAt,
      lastActivityAt: visit.checkedOutAt ?? visit.checkedInAt ?? visit.updatedAt
    }));

    const permanentResults = permanentPasses.map((pass) => ({
      id: pass.id,
      recordType: "PERMANENT_PASS" as const,
      fullName: pass.fullName,
      phone: pass.phone,
      company: null,
      vehicleNumber: pass.authorizedVehicles[0]?.plateNumber ?? null,
      organizationName: pass.organization.name,
      department: pass.department,
      hostName: pass.position,
      purpose: null,
      passNumber: pass.passNumber,
      status: pass.status,
      createdAt: pass.createdAt,
      lastActivityAt: pass.lastActivityAt
    }));

    const organizationResults = organizations.map((organization) => ({
      id: organization.id,
      recordType: "ORGANIZATION" as const,
      fullName: organization.name,
      phone: null,
      company: null,
      vehicleNumber: null,
      organizationName: organization.name,
      department: null,
      hostName: null,
      purpose: organization.code ? `Organization code: ${organization.code}` : "Organization",
      passNumber: null,
      status: "ACTIVE",
      createdAt: organization.createdAt,
      lastActivityAt: organization.updatedAt
    }));

    const combined = [...visitorResults, ...permanentResults, ...organizationResults]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    response.setHeader("Cache-Control", "no-store");
    return response.json({
      success: true,
      data: combined.slice(0, 100),
      meta: { total: Math.min(combined.length, 100), query }
    });
  } catch (error) {
    return next(error);
  }
});

visitorRouter.get("/report", requireBuilding, async (request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const parsedPeriod = reportPeriodSchema.safeParse(
      typeof request.query.period === "string" ? request.query.period : "today"
    );

    if (!parsedPeriod.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Report period must be today, week, or month."
        }
      });
    }

    const visits = await prisma.visitRequest.findMany({
      where: {
        siteId: user.siteId!,
        createdAt: reportDateRange(parsedPeriod.data)
      },
      include: visitInclude,
      orderBy: { createdAt: "desc" }
    });

    response.setHeader("Cache-Control", "no-store");
    return response.json({
      success: true,
      period: parsedPeriod.data,
      count: visits.length,
      data: visits.map(publicVisit)
    });
  } catch (error) {
    return next(error);
  }
});

visitorRouter.get("/", requireBuilding, async (request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const parsedPeriod = reportPeriodSchema.safeParse(
      typeof request.query.period === "string" ? request.query.period : "today"
    );

    if (!parsedPeriod.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Period must be today, week, or month."
        }
      });
    }

    // The visible Reception / Visitors list defaults to today's visits.
    // Historical records remain in PostgreSQL and are available via /report.
    const visits = await prisma.visitRequest.findMany({
      where: {
        siteId: user.siteId!,
        createdAt: reportDateRange(parsedPeriod.data)
      },
      include: visitInclude,
      orderBy: { createdAt: "desc" }
    });

    response.setHeader("Cache-Control", "no-store");
    return response.json({ success: true, period: parsedPeriod.data, data: visits.map(publicVisit) });
  } catch (error) {
    return next(error);
  }
});

visitorRouter.get("/operations", requireBuilding, async (_request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const siteId = user.siteId!;

    const [pending, inside] = await Promise.all([
      prisma.visitRequest.findMany({
        where: { siteId, status: "PENDING_APPROVAL" },
        include: visitInclude,
        orderBy: { createdAt: "asc" },
        take: 100
      }),
      prisma.visitRequest.findMany({
        where: { siteId, status: "INSIDE" },
        include: visitInclude,
        orderBy: { checkedInAt: "desc" },
        take: 200
      })
    ]);

    response.setHeader("Cache-Control", "no-store");
    return response.json({
      success: true,
      data: {
        pending: pending.map(publicVisit),
        inside: inside.map(publicVisit)
      }
    });
  } catch (error) {
    return next(error);
  }
});

visitorRouter.post<{ visitId: string }>("/:visitId/deny", requireBuilding, async (request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const visitId = z.string().uuid().safeParse(request.params.visitId);
    if (!visitId.success) {
      return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid visit ID." } });
    }

    const result = await prisma.visitRequest.updateMany({
      where: { id: visitId.data, siteId: user.siteId!, status: "PENDING_APPROVAL" },
      data: { status: "REJECTED" }
    });

    if (!result.count) {
      return response.status(409).json({
        error: { code: "VISIT_NOT_PENDING", message: "Only a pending visit can be denied." }
      });
    }

    return response.json({ success: true, data: { id: visitId.data, status: "REJECTED" } });
  } catch (error) {
    return next(error);
  }
});

visitorRouter.post<{ visitId: string }>("/:visitId/check-out", requireBuilding, async (request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const visitId = z.string().uuid().safeParse(request.params.visitId);
    if (!visitId.success) {
      return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid visit ID." } });
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM visit_requests WHERE id = ${visitId.data}::uuid FOR UPDATE`;
      const visit = await tx.visitRequest.findFirst({
        where: { id: visitId.data, siteId: user.siteId!, status: "INSIDE" },
        include: { pass: true }
      });
      if (!visit) return null;

      await tx.visitRequest.update({
        where: { id: visit.id },
        data: { status: "CHECKED_OUT", checkedOutAt: now }
      });

      if (visit.pass?.status === "ACTIVE") {
        await tx.visitorPass.update({
          where: { id: visit.pass.id },
          data: { status: "USED" }
        });
      }

      await tx.accessEvent.create({
        data: {
          siteId: user.siteId!,
          organizationId: visit.organizationId,
          visitId: visit.id,
          visitorPassId: visit.pass?.id ?? null,
          direction: "EXIT",
          decision: "GRANTED",
          turnstileOpened: false,
          metadata: {
            source: "MANUAL_SECURITY_CHECKOUT",
            performedBy: user.username
          }
        }
      });

      return visit;
    });

    if (!result) {
      return response.status(409).json({
        error: { code: "VISITOR_NOT_INSIDE", message: "Only a visitor currently inside can be checked out." }
      });
    }

    return response.json({
      success: true,
      data: { id: result.id, status: "CHECKED_OUT", checkedOutAt: now }
    });
  } catch (error) {
    return next(error);
  }
});

visitorRouter.post<{ visitId: string }>("/:visitId/approve", requireBuilding, async (request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    if (!z.string().uuid().safeParse(request.params.visitId).success) {
      return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid visit ID." } });
    }
    const visit = await prisma.visitRequest.findFirst({ where: { id: request.params.visitId, siteId: user.siteId! } });
    if (!visit || !await activeMembership(user.siteId!, visit.organizationId)) {
      return response.status(404).json({ error: { code: "VISIT_NOT_AVAILABLE", message: "Visit not available in this building." } });
    }
    const updated = await prisma.visitRequest.updateMany({
      where: { id: visit.id, siteId: user.siteId!, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedAt: new Date() }
    });
    if (!updated.count) return response.status(409).json({ error: { code: "VISIT_NOT_PENDING", message: "Only a pending visit can be approved." } });
    return response.json({ success: true, data: { id: visit.id, status: "APPROVED" } });
  } catch (error) { return next(error); }
});


visitorRouter.post<{ visitId: string }>("/:visitId/approve-and-issue", requireBuilding, async (request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    if (!z.string().uuid().safeParse(request.params.visitId).success) {
      return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid visit ID." } });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM visit_requests WHERE id = ${request.params.visitId}::uuid FOR UPDATE`;

      const visit = await tx.visitRequest.findFirst({
        where: { id: request.params.visitId, siteId: user.siteId! },
        include: visitInclude
      });

      if (!visit || !await activeMembership(user.siteId!, visit.organizationId)) return null;

      if (visit.status === "PENDING_APPROVAL") {
        await tx.visitRequest.update({
          where: { id: visit.id },
          data: { status: "APPROVED", approvedAt: new Date() }
        });
      } else if (!["APPROVED", "PASS_ISSUED"].includes(visit.status)) {
        return { conflict: true as const };
      }

      const now = new Date();
      const token = visit.kioskReceiptHash
        ? visitorPassTokenForReceiptHash(visit.id, visit.kioskReceiptHash)
        : crypto.randomBytes(32).toString("base64url");
      const { pass } = await issueVisitorPass(tx, {
        visitId: visit.id,
        organizationId: visit.organizationId,
        token,
        validFrom: now
      });

      if (pass.qrTokenHash !== hashToken(token) || pass.status !== "ACTIVE" || pass.validUntil <= now) {
        return { conflict: true as const };
      }

      return {
        passNumber: pass.passNumber,
        qrToken: token,
        fullName: visit.visitor.fullName,
        organizationName: visit.organization.name,
        departmentOrOffice: visit.destinationOffice,
        hostName: visit.hostNameSnapshot,
        purpose: visit.purpose,
        issuedAt: pass.issuedAt,
        validFrom: pass.validFrom,
        validUntil: pass.validUntil
      };
    });

    if (!result) return response.status(404).json({ error: { code: "VISIT_NOT_AVAILABLE", message: "Visit not available in this building." } });
    if ("conflict" in result) return response.status(409).json({ error: { code: "VISIT_NOT_APPROVABLE", message: "This visit cannot be approved." } });
    if (!result.qrToken) return response.status(409).json({ error: { code: "PASS_ALREADY_ISSUED", message: "This pass already exists with a different credential. Use the original ticket or contact an administrator." } });

    const QRCode = (await import("qrcode")).default;
    const qrValue = await QRCode.toDataURL(visitorPassQrValue(result.qrToken), { width: 300, margin: 4, errorCorrectionLevel: "M" });

    return response.json({
      success: true,
      data: {
        pass: {
          passNumber: result.passNumber,
          qrValue,
          fullName: result.fullName,
          organizationName: result.organizationName,
          departmentOrOffice: result.departmentOrOffice,
          hostName: result.hostName,
          purpose: result.purpose,
          issuedAt: result.issuedAt,
          validFrom: result.validFrom,
          validUntil: result.validUntil
        }
      }
    });
  } catch (error) { return next(error); }
});

const receiptSchema = z.object({ kioskId: z.string().uuid(), receiptToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

// Receipt proves possession of this registration, in addition to kiosk device auth.
visitorRouter.post<{ visitId: string }>("/:visitId/kiosk-status", async (request, response, next) => {
  try {
    const parsed = receiptSchema.safeParse(request.body);
    if (!parsed.success || !z.string().uuid().safeParse(request.params.visitId).success) {
      return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid registration receipt." } });
    }
    const kiosk = await getActivatedKiosk(request, parsed.data.kioskId);
    const visit = kiosk && await prisma.visitRequest.findFirst({ where: {
      id: request.params.visitId, kioskId: kiosk.id, siteId: kiosk.siteId,
      kioskReceiptHash: hashToken(parsed.data.receiptToken)
    }, include: visitInclude });
    if (!visit) return response.status(403).json({ error: { code: "RECEIPT_INVALID", message: "This registration is unavailable on this device." } });
    response.setHeader("Cache-Control", "no-store");
    return response.json({ success: true, data: publicVisit(visit) });
  } catch (error) { return next(error); }
});

visitorRouter.post<{ visitId: string }>("/:visitId/kiosk-pass", async (request, response, next) => {
  try {
    const parsed = receiptSchema.safeParse(request.body);
    if (!parsed.success || !z.string().uuid().safeParse(request.params.visitId).success) {
      return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid registration receipt." } });
    }
    const kiosk = await getActivatedKiosk(request, parsed.data.kioskId);
    if (!kiosk) return response.status(403).json({ error: { code: "KIOSK_NOT_AVAILABLE", message: "Activated kiosk device required." } });
    // Legacy token supports already-issued kiosk tickets. New passes use a stable
    // token derived from the server-side receipt hash, allowing approved tickets to be
    // retrieved by the kiosk and printed by authorized Security without storing raw tokens.
    const legacyToken = crypto.createHmac("sha256", parsed.data.receiptToken).update(`visitor-pass:${request.params.visitId}`).digest("base64url");
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM visit_requests WHERE id = ${request.params.visitId}::uuid FOR UPDATE`;
      const visit = await tx.visitRequest.findFirst({ where: {
        id: request.params.visitId, siteId: kiosk.siteId, kioskId: kiosk.id,
        kioskReceiptHash: hashToken(parsed.data.receiptToken)
      }, include: { ...visitInclude, pass: true } });
      if (!visit || !visit.approvedAt || !["APPROVED", "PASS_ISSUED"].includes(visit.status)) return null;
      const membership = await tx.siteOrganization.findFirst({ where: {
        siteId: kiosk.siteId, organizationId: visit.organizationId, isActive: true,
        organization: { isActive: true }, site: { isActive: true, status: "ACTIVE" }
      } });
      if (!membership) return null;
      const now = new Date();
      const stableToken = visitorPassTokenForReceiptHash(visit.id, visit.kioskReceiptHash!);
      let token = stableToken;
      if (visit.pass) {
        if (visit.pass.qrTokenHash === hashToken(legacyToken)) token = legacyToken;
        else if (visit.pass.qrTokenHash !== hashToken(stableToken)) return null;
        if (visit.pass.status !== "ACTIVE" || visit.pass.validUntil <= now) return null;
      }
      const { pass } = await issueVisitorPass(tx, {
        visitId: visit.id,
        organizationId: visit.organizationId,
        token,
        validFrom: now
      });
      if (pass.qrTokenHash !== hashToken(token) || pass.status !== "ACTIVE" || pass.validUntil <= now) return null;
      return {
        passId: pass.id, passNumber: pass.passNumber, fullName: visit.visitor.fullName,
        site: visit.site, organization: visit.organization,
        departmentOrOffice: visit.destinationOffice, hostName: visit.hostNameSnapshot, purpose: visit.purpose,
        issuedAt: pass.issuedAt, validFrom: pass.validFrom, validUntil: pass.validUntil,
        qrValue: visitorPassQrValue(token)
      };
    });
    if (!result) return response.status(409).json({ error: { code: "PASS_NOT_ISSUABLE", message: "This visit must be approved and eligible before issuing an entry pass." } });
    response.setHeader("Cache-Control", "no-store");
    return response.json({ success: true, data: result });
  } catch (error) { return next(error); }
});
