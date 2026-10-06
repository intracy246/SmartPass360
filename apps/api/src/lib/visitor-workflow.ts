import crypto from "node:crypto";
import type { Request } from "express";
import { prisma } from "./prisma";
import type { Prisma } from "../generated/prisma/client";

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const visitorPassQrValue = (token: string) =>
  `smartpass360://visitor-pass/${token}`;

export async function issueVisitorPass(
  transaction: Prisma.TransactionClient,
  input: {
    visitId: string;
    organizationId: string;
    token: string;
    validFrom?: Date;
  }
) {
  const validFrom = input.validFrom ?? new Date();
  const existingPass = await transaction.visitorPass.findUnique({
    where: { visitId: input.visitId }
  });

  if (existingPass) {
    await transaction.visitRequest.update({
      where: { id: input.visitId },
      data: { status: "PASS_ISSUED" }
    });
    return { pass: existingPass, created: false };
  }

  const pass = await transaction.visitorPass.create({
    data: {
      organizationId: input.organizationId,
      visitId: input.visitId,
      passNumber: `VP-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
      qrTokenHash: hashToken(input.token),
      validFrom,
      validUntil: new Date(validFrom.getTime() + 8 * 60 * 60 * 1000)
    }
  });

  await transaction.visitRequest.update({
    where: { id: input.visitId },
    data: { status: "PASS_ISSUED" }
  });

  return { pass, created: true };
}

export const visitInclude = {
  visitor: true,
  organization: { select: { id: true, name: true } },
  site: { select: { id: true, name: true, logoUrl: true, isActive: true, status: true } },
  pass: { omit: { qrTokenHash: true } }
} satisfies Prisma.VisitRequestInclude;

export function publicVisit(visit: Prisma.VisitRequestGetPayload<{ include: typeof visitInclude }>) {
  return {
    id: visit.id, visitorId: visit.visitorId, fullName: visit.visitor.fullName,
    phone: visit.visitor.phone, organization: visit.organization,
    departmentOrOffice: visit.destinationOffice, hostName: visit.hostNameSnapshot,
    purpose: visit.purpose, registeredAt: visit.createdAt, source: visit.source,
    status: visit.status, approvedAt: visit.approvedAt,
    checkedInAt: visit.checkedInAt, checkedOutAt: visit.checkedOutAt, pass: visit.pass,
    site: visit.site
  };
}

export async function getActivatedKiosk(request: Request, kioskId: string) {
  const deviceId = request.get("x-kiosk-device-id");
  if (!deviceId) return null;
  return prisma.kiosk.findFirst({
    where: { id: kioskId, deviceId, activatedAt: { not: null }, isActive: true,
      site: { isActive: true, status: "ACTIVE" } },
    select: { id: true, siteId: true }
  });
}

export async function activeMembership(siteId: string, organizationId: string) {
  return prisma.siteOrganization.findFirst({
    where: { siteId, organizationId, isActive: true, organization: { isActive: true },
      site: { isActive: true, status: "ACTIVE" } }, select: { id: true }
  });
}
