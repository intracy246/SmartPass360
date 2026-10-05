import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const accessRouter = Router();

const scanSchema = z.object({
  qrCode: z.string().trim().min(1).max(2000),
  gateId: z.string().uuid()
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
                  isActive: true
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
                  isActive: true
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

      let denialReason: string | null = null;

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
              gateName: gate.name
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
                    commandIssued: "UNLOCK"
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

