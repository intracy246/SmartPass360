import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireBuilding, type AuthUser } from "../middleware/auth.middleware";
import { activeMembership, getActivatedKiosk, hashToken, publicVisit, visitInclude } from "../lib/visitor-workflow";

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
    if (!(await organizationBelongsToSite(user.siteId!, parsed.data.organizationId))) {
      return response.status(403).json({
        error: { code: "INVALID_ORGANIZATION", message: "Selected organization does not belong to your building." }
      });
    }

    const { visitor, visit } = await createVisit({ ...parsed.data, siteId: user.siteId!, source: "RECEPTION" });
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

visitorRouter.get("/", requireBuilding, async (_request, response, next) => {
  try {
    const user = response.locals.authUser as AuthUser;
    const visits = await prisma.visitRequest.findMany({
      where: { siteId: user.siteId! }, include: visitInclude,
      orderBy: { createdAt: "desc" }, take: 100
    });
    response.setHeader("Cache-Control", "no-store");
    return response.json({ success: true, data: visits.map(publicVisit) });
  } catch (error) { return next(error); }
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
    // The server-generated 256-bit receipt is held only by the kiosk. Derive a
    // separate QR credential so issuance retries can recover it without storing raw tokens.
    const token = crypto.createHmac("sha256", parsed.data.receiptToken).update(`visitor-pass:${request.params.visitId}`).digest("base64url");
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
      if (visit.pass && (visit.pass.status !== "ACTIVE" || visit.pass.validUntil <= now || visit.pass.qrTokenHash !== hashToken(token))) return null;
      const pass = visit.pass ?? await tx.visitorPass.create({ data: {
        organizationId: visit.organizationId, visitId: visit.id,
        passNumber: `VP-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
        qrTokenHash: hashToken(token), validFrom: now, validUntil: new Date(now.getTime() + 8 * 60 * 60 * 1000)
      } });
      await tx.visitRequest.update({ where: { id: visit.id }, data: { status: "PASS_ISSUED" } });
      return {
        passId: pass.id, passNumber: pass.passNumber, fullName: visit.visitor.fullName,
        site: visit.site, organization: visit.organization,
        departmentOrOffice: visit.destinationOffice, hostName: visit.hostNameSnapshot, purpose: visit.purpose,
        issuedAt: pass.issuedAt, validFrom: pass.validFrom, validUntil: pass.validUntil,
        qrValue: `smartpass360://visitor-pass/${token}`
      };
    });
    if (!result) return response.status(409).json({ error: { code: "PASS_NOT_ISSUABLE", message: "This visit must be approved and eligible before issuing an entry pass." } });
    response.setHeader("Cache-Control", "no-store");
    return response.json({ success: true, data: result });
  } catch (error) { return next(error); }
});
