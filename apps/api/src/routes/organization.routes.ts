import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { requireBuilding, type AuthUser } from "../middleware/auth.middleware.js";

export const organizationRouter = Router();

const organizationTypeSchema = z.enum([
  "COMPANY",
  "GOVERNMENT",
  "UNIVERSITY",
  "HOSPITAL",
  "NGO",
  "BANK",
  "OTHER"
]);

const querySchema = z.object({
  search: z.string().trim().optional(),

  page: z.coerce
    .number()
    .int()
    .positive()
    .default(1),

  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20),

  active: z
    .enum(["true", "false"])
    .optional()
});

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) =>
    value && value.length > 0 ? value : undefined
  );

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(50),

  name: z
    .string()
    .trim()
    .min(3)
    .max(200),

  shortName: optionalText,

  organizationType:
    organizationTypeSchema.default("OTHER"),

  email: optionalText,
  phone: optionalText,
  website: optionalText,
  address: optionalText,
  city: optionalText,
  country: optionalText
});

organizationRouter.get(
  "/",
  requireBuilding,
  async (request, response, next) => {
    try {
      const parsed =
        querySchema.safeParse(request.query);

      if (!parsed.success) {
        return response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data.",
            details: parsed.error.flatten()
          }
        });
      }

      const {
        search,
        page,
        pageSize,
        active
      } = parsed.data;

      const user = response.locals.authUser as AuthUser;

      const where = {
        siteOrganizations: { some: { siteId: user.siteId!, isActive: true } },
        ...(active !== undefined
          ? { isActive: active === "true" }
          : {}),
        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive" as const
                  }
                },
                {
                  code: {
                    contains: search,
                    mode: "insensitive" as const
                  }
                },
                {
                  shortName: {
                    contains: search,
                    mode: "insensitive" as const
                  }
                }
              ]
            }
          : {})
      };

      const skip =
        (page - 1) * pageSize;

      const [organizations, total] =
        await prisma.$transaction([
          prisma.organization.findMany({
            where,
            orderBy: {
              name: "asc"
            },
            skip,
            take: pageSize
          }),

          prisma.organization.count({
            where
          })
        ]);

      return response.status(200).json({
        success: true,
        data: organizations,
        meta: {
          page,
          pageSize,
          total,
          totalPages:
            total === 0
              ? 0
              : Math.ceil(total / pageSize)
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

organizationRouter.post(
  "/",
  requireBuilding,
  async (request, response, next) => {
    try {
      const parsed =
        createSchema.safeParse(request.body);

      if (!parsed.success) {
        return response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data.",
            details: parsed.error.flatten()
          }
        });
      }

      const code =
        parsed.data.code.toUpperCase();

      const existing =
        await prisma.organization.findUnique({
          where: {
            code
          }
        });

      if (existing) {
        return response.status(409).json({
          error: {
            code: "ORGANIZATION_CODE_EXISTS",
            message:
              "An organization with this code already exists."
          }
        });
      }

      const user = response.locals.authUser as AuthUser;

      const organization =
        await prisma.organization.create({
          data: {
            code,
            name: parsed.data.name,
            shortName:
              parsed.data.shortName,
            organizationType:
              parsed.data.organizationType,
            email:
              parsed.data.email,
            phone:
              parsed.data.phone,
            website:
              parsed.data.website,
            address:
              parsed.data.address,
            city:
              parsed.data.city,
            country:
              parsed.data.country,
            siteOrganizations: {
              create: { siteId: user.siteId! }
            }
          }
        });

      return response.status(201).json({
        success: true,
        data: organization
      });
    } catch (error) {
      return next(error);
    }
  }
);


const organizationIdSchema = z.string().uuid();
const catalogNameSchema = z.object({ name: z.string().trim().min(2).max(120) });

async function organizationAvailableToSite(organizationId: string, siteId: string) {
  return prisma.siteOrganization.findFirst({
    where: { organizationId, siteId, isActive: true, organization: { isActive: true } },
    select: { id: true }
  });
}

organizationRouter.get("/:organizationId/departments", requireBuilding, async (request, response, next) => {
  try {
    const id = organizationIdSchema.safeParse(request.params.organizationId);
    if (!id.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid organization ID." } });
    const user = response.locals.authUser as AuthUser;
    if (!await organizationAvailableToSite(id.data, user.siteId!)) return response.status(404).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found." } });
    const data = await prisma.department.findMany({ where: { organizationId: id.data, isActive: true }, orderBy: { name: "asc" } });
    return response.json({ success: true, data });
  } catch (error) { return next(error); }
});

organizationRouter.post("/:organizationId/departments", requireBuilding, async (request, response, next) => {
  try {
    const id = organizationIdSchema.safeParse(request.params.organizationId);
    const body = catalogNameSchema.safeParse(request.body);
    if (!id.success || !body.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Provide a valid department name." } });
    const user = response.locals.authUser as AuthUser;
    if (!await organizationAvailableToSite(id.data, user.siteId!)) return response.status(404).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found." } });
    const name = body.data.name.trim();
    const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);
    const duplicate = await prisma.department.findFirst({ where: { organizationId: id.data, name: { equals: name, mode: "insensitive" } } });
    if (duplicate) return response.status(409).json({ error: { code: "DEPARTMENT_EXISTS", message: "This department already exists." } });
    const data = await prisma.department.create({ data: { organizationId: id.data, name, code } });
    return response.status(201).json({ success: true, data });
  } catch (error) { return next(error); }
});

organizationRouter.delete("/:organizationId/departments/:departmentId", requireBuilding, async (request, response, next) => {
  try {
    const id = organizationIdSchema.safeParse(request.params.organizationId);
    const departmentId = organizationIdSchema.safeParse(request.params.departmentId);
    if (!id.success || !departmentId.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid department ID." } });
    const user = response.locals.authUser as AuthUser;
    if (!await organizationAvailableToSite(id.data, user.siteId!)) return response.status(404).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found." } });
    const department = await prisma.department.findFirst({ where: { id: departmentId.data, organizationId: id.data, isActive: true }, select: { id: true } });
    if (!department) return response.status(404).json({ error: { code: "DEPARTMENT_NOT_FOUND", message: "Department not found." } });
    await prisma.department.update({ where: { id: department.id }, data: { isActive: false } });
    return response.json({ success: true, data: { id: department.id, isActive: false } });
  } catch (error) { return next(error); }
});

organizationRouter.get("/:organizationId/purposes", requireBuilding, async (request, response, next) => {
  try {
    const id = organizationIdSchema.safeParse(request.params.organizationId);
    if (!id.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid organization ID." } });
    const user = response.locals.authUser as AuthUser;
    if (!await organizationAvailableToSite(id.data, user.siteId!)) return response.status(404).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found." } });
    const data = await prisma.purposeOption.findMany({ where: { organizationId: id.data, isActive: true }, orderBy: { name: "asc" } });
    return response.json({ success: true, data: [{ id: "system-others", name: "Others", isSystem: true }, ...data.map(item => ({ ...item, isSystem: false }))] });
  } catch (error) { return next(error); }
});

organizationRouter.post("/:organizationId/purposes", requireBuilding, async (request, response, next) => {
  try {
    const id = organizationIdSchema.safeParse(request.params.organizationId);
    const body = catalogNameSchema.safeParse(request.body);
    if (!id.success || !body.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Provide a valid purpose name." } });
    const user = response.locals.authUser as AuthUser;
    if (!await organizationAvailableToSite(id.data, user.siteId!)) return response.status(404).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found." } });
    const name = body.data.name.trim();
    if (name.toLowerCase() === "others") return response.status(400).json({ error: { code: "RESERVED_PURPOSE", message: "Others is a reserved system option." } });
    const duplicate = await prisma.purposeOption.findFirst({ where: { organizationId: id.data, name: { equals: name, mode: "insensitive" } } });
    if (duplicate) return response.status(409).json({ error: { code: "PURPOSE_EXISTS", message: "This purpose already exists." } });
    const data = await prisma.purposeOption.create({ data: { organizationId: id.data, name } });
    return response.status(201).json({ success: true, data });
  } catch (error) { return next(error); }
});

organizationRouter.delete("/:organizationId/purposes/:purposeId", requireBuilding, async (request, response, next) => {
  try {
    const id = organizationIdSchema.safeParse(request.params.organizationId);
    const purposeId = organizationIdSchema.safeParse(request.params.purposeId);
    if (!id.success || !purposeId.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid purpose ID." } });
    const user = response.locals.authUser as AuthUser;
    if (!await organizationAvailableToSite(id.data, user.siteId!)) return response.status(404).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found." } });
    const purpose = await prisma.purposeOption.findFirst({ where: { id: purposeId.data, organizationId: id.data, isActive: true }, select: { id: true } });
    if (!purpose) return response.status(404).json({ error: { code: "PURPOSE_NOT_FOUND", message: "Purpose not found." } });
    await prisma.purposeOption.update({ where: { id: purpose.id }, data: { isActive: false } });
    return response.json({ success: true, data: { id: purpose.id, isActive: false } });
  } catch (error) { return next(error); }
});

organizationRouter.patch("/:organizationId/profile", requireBuilding, async (request, response, next) => {
  try {
    const id = organizationIdSchema.safeParse(request.params.organizationId);
    const body = z.object({ logoUrl: z.string().trim().url().max(1000).nullable() }).safeParse(request.body);
    if (!id.success || !body.success) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Provide a valid organization image URL." } });
    const user = response.locals.authUser as AuthUser;
    if (!await organizationAvailableToSite(id.data, user.siteId!)) return response.status(404).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found." } });
    const data = await prisma.organization.update({ where: { id: id.data }, data: { logoUrl: body.data.logoUrl } });
    return response.json({ success: true, data });
  } catch (error) { return next(error); }
});
