import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireBuilding, type AuthUser } from "../middleware/auth.middleware";
import type { Prisma } from "../generated/prisma/client";

export const visitorPassRouter = Router();
const querySchema = z.object({
  search: z.string().trim().optional(), source: z.string().optional(), status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

visitorPassRouter.get("/", requireBuilding, async (request, response, next) => {
  try {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid pass filters." } });
    const { siteId } = response.locals.authUser as AuthUser;
    const { page, pageSize, search, source, status } = parsed.data;
    const visitWhere: Prisma.VisitRequestWhereInput = { siteId: siteId!, ...(source ? { source } : {}) };
    const where: Prisma.VisitorPassWhereInput = { visit: visitWhere };
    if (search) where.OR = [{ passNumber: { contains: search, mode: "insensitive" } }, { visit: { visitor: { fullName: { contains: search, mode: "insensitive" } } } }];
    const visitStatus = status === "INSIDE" ? "INSIDE" : status === "EXITED" ? "CHECKED_OUT" : undefined;
    if (visitStatus) visitWhere.status = visitStatus;
    else if (status === "ACTIVE") { where.status = "ACTIVE"; where.validUntil = { gt: new Date() }; visitWhere.status = { not: "INSIDE" }; }
    else if (status === "EXPIRED") where.AND = [{ OR: [{ status: "EXPIRED" }, { validUntil: { lte: new Date() }, status: "ACTIVE" }] }];
    else if (status === "REVOKED") where.status = "REVOKED";
    else if (status) where.id = "00000000-0000-0000-0000-000000000000";
    const [passes, total] = await Promise.all([
      prisma.visitorPass.findMany({ where, omit: { qrTokenHash: true }, include: { visit: { include: { visitor: true, organization: true, site: { select: { name: true } } } } }, orderBy: { issuedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.visitorPass.count({ where })
    ]);
    return response.json({ success: true, data: passes.map(pass => ({
      id: pass.id, passNumber: pass.passNumber, visitorId: pass.visit.visitorId, visitId: pass.visitId,
      visitorName: pass.visit.visitor.fullName, company: pass.visit.visitor.company,
      visitorType: pass.visit.visitorType, hostName: pass.visit.hostNameSnapshot, departmentName: pass.visit.destinationOffice,
      organizationName: pass.visit.organization.name, buildingName: pass.visit.site?.name,
      purpose: pass.visit.purpose, source: pass.visit.source,
      status: pass.visit.status === "CHECKED_OUT" ? "EXITED" : pass.visit.status === "INSIDE" ? "INSIDE" : pass.status === "ACTIVE" && pass.validUntil <= new Date() ? "EXPIRED" : pass.status,
      validFrom: pass.validFrom, validUntil: pass.validUntil, enteredAt: pass.visit.checkedInAt, exitedAt: pass.visit.checkedOutAt, issuedAt: pass.issuedAt
    })), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) { return next(error); }
});
