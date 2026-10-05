type ScanState = {
  buildingActive: boolean;
  gate: { isActive: boolean; status: string; organizationId: string; direction: string; organization: { isActive: boolean } } | null;
  pass: { organizationId: string; status: string; validFrom: Date; validUntil: Date; visit: { approvedAt: Date | null; status: string } } | null;
  last: { direction: string; scannedAt: Date } | null;
  membershipActive: boolean;
  formatValid: boolean;
  requestedDirection?: "ENTRY" | "EXIT";
  now: Date;
};

export function visitorAccessDecision(state: ScanState) {
  const { gate, pass, last, now } = state;
  const direction = last?.direction === "ENTRY" ? "EXIT" : "ENTRY";
  let denialReason: string | null = null;
  if (!state.buildingActive) denialReason = "BUILDING_INACTIVE";
  else if (!gate) denialReason = "WRONG_GATE";
  else if (!gate.isActive || gate.status !== "ONLINE" || !gate.organization.isActive) denialReason = "GATE_UNAVAILABLE";
  else if (!pass) denialReason = state.formatValid ? "UNKNOWN_PASS" : "INVALID_QR_FORMAT";
  else if (pass.organizationId !== gate.organizationId) denialReason = "WRONG_GATE";
  else if (!state.membershipActive) denialReason = "ORGANIZATION_INACTIVE";
  else if (pass.status !== "ACTIVE") denialReason = `PASS_${pass.status}`;
  else if (now < pass.validFrom || now >= pass.validUntil) denialReason = "OUTSIDE_VALID_TIME";
  else if (!pass.visit.approvedAt || !["PASS_ISSUED", "READY_FOR_ENTRY", "INSIDE"].includes(pass.visit.status)) denialReason = "VISIT_NOT_ACTIVE";
  else if ((pass.visit.status === "INSIDE") !== (last?.direction === "ENTRY")) denialReason = "STATE_MISMATCH";
  else if (state.requestedDirection && state.requestedDirection !== direction) denialReason = "ANTI_PASSBACK";
  else if (gate.direction !== "BIDIRECTIONAL" && gate.direction !== direction) denialReason = "WRONG_GATE_DIRECTION";
  else if (last && now.getTime() - last.scannedAt.getTime() < 2000) denialReason = "SCAN_TOO_SOON";
  return { direction: direction as "ENTRY" | "EXIT", denialReason };
}
