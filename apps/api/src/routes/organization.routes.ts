import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireBuilding, type AuthUser } from "../middleware/auth.middleware";

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
