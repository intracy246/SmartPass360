import { z } from "zod";
import { visitorAccessDecision } from "./visitor-access-rules.js";
import { prisma } from "../lib/prisma.js";
import { hashToken } from "../lib/visitor-workflow.js";
import { Prisma } from "../generated/prisma/client.js";

export const visitorScanSchema = z.object({
  credential: z.string().trim().min(1).max(2000), gateId: z.string().uuid(),
  direction: z.enum(["ENTRY", "EXIT"]).optional(), requestId: z.string().uuid().optional()
});

export async function validateVisitorScan(
  siteId: string,
  input: z.infer<typeof visitorScanSchema>,
  options: { hardwareAvailable?: boolean } = {}
) {
  const hardwareAvailable = options.hardwareAvailable ?? false;
  // Serializable retries and a row lock protect authoritative state from concurrent scanners.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        if (input.requestId) {
          const previous = await tx.accessEvent.findUnique({ where: { siteId_requestId: { siteId, requestId: input.requestId } } });
          if (previous) return { decision: previous.decision, reason: previous.denialReason ?? "VALID_PASS", direction: previous.direction, activityType: previous.direction, eventId: previous.id, accessEventId: previous.id, turnstileCommand: "KEEP_LOCKED", timestamp: previous.scannedAt, message: "Duplicate scan request; no new unlock command." };
        }
        const site = await tx.site.findUnique({ where: { id: siteId }, select: { isActive: true, status: true } });
        const gate = await tx.gate.findFirst({ where: { id: input.gateId, organization: { siteOrganizations: { some: { siteId, isActive: true } } } }, include: { organization: true } });
        const token = input.credential.replace(/^smartpass360:\/\/visitor-pass\//, "");
        const formatValid = /^[A-Za-z0-9_-]{43}$/.test(token);
        const found = formatValid ? await tx.visitorPass.findFirst({ where: { qrTokenHash: hashToken(token), visit: { siteId } }, select: { id: true, visitId: true } }) : null;
        // Only lock/read a credential belonging to this building.
        if (found) await tx.$queryRaw`SELECT id FROM visit_requests WHERE id = ${found.visitId}::uuid FOR UPDATE`;
        const pass = found ? await tx.visitorPass.findUnique({ where: { id: found.id }, include: { visit: { include: { visitor: true } }, organization: true } }) : null;
        const last = pass ? await tx.accessEvent.findFirst({ where: { visitorPassId: pass.id, decision: "GRANTED" }, orderBy: { scannedAt: "desc" } }) : null;
        const now = new Date();
        const membership = pass && await tx.siteOrganization.findFirst({ where: { siteId, organizationId: pass.organizationId, isActive: true, organization: { isActive: true } } });
        const { direction, denialReason } = visitorAccessDecision({
          buildingActive: Boolean(site?.isActive && site.status === "ACTIVE"),
          gate, pass, last, now, membershipActive: Boolean(membership), formatValid,
          hardwareAvailable,
          requestedDirection: input.direction
        });

        const event = await tx.accessEvent.create({ data: {
          siteId, requestId: input.requestId, organizationId: pass?.organizationId ?? gate?.organizationId,
          visitId: pass?.visitId, visitorPassId: pass?.id, gateId: gate?.id,
          direction: input.direction ?? direction, decision: denialReason ? "DENIED" : "GRANTED",
          denialReason, scannedAt: now,
          // Validation authorizes a command but cannot prove the relay actuated.
          // The trusted gate adapter confirms physical opening through /hardware/ack.
          turnstileOpened: false,
          metadata: {
            validationMode: hardwareAvailable ? "HARDWARE" : "SOFTWARE",
            commandIssued: denialReason
              ? "KEEP_LOCKED"
              : hardwareAvailable
                ? "UNLOCK"
                : "VALIDATED_ONLY",
            requestedGateId: input.gateId
          }
        } });
        if (!denialReason && pass) {
          await tx.visitRequest.update({ where: { id: pass.visitId }, data: direction === "ENTRY" ? { status: "INSIDE", checkedInAt: now } : { status: "CHECKED_OUT", checkedOutAt: now } });
          if (direction === "EXIT") await tx.visitorPass.update({ where: { id: pass.id }, data: { status: "USED" } });
        }
        return {
          decision: event.decision, reason: denialReason ?? "VALID_PASS", denialReason,
          direction: event.direction, activityType: event.direction,
          eventId: event.id, accessEventId: event.id, passId: pass?.id, passNumber: pass?.passNumber,
          visitorName: pass?.visit.visitor.fullName, gateName: gate?.name,
          turnstileCommand: denialReason
            ? "KEEP_LOCKED"
            : hardwareAvailable
              ? "UNLOCK"
              : "VALIDATED_ONLY",
          timestamp: now,
          message: denialReason ? `Access denied: ${denialReason}` : `Visitor ${direction === "ENTRY" ? "entry" : "exit"} granted.`
        };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code) && attempt < 3) continue;
      throw error;
    }
  }
}
