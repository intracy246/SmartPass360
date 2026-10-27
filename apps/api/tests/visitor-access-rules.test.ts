// Pure, in-memory decision tests. These create no database records.
import assert from "node:assert/strict";
import { test } from "node:test";
import { visitorAccessDecision } from "../src/services/visitor-access-rules";

function validState(): Parameters<typeof visitorAccessDecision>[0] {
  return {
    buildingActive: true, membershipActive: true, formatValid: true, hardwareAvailable: true,
    gate: { isActive: true, status: "ONLINE", organizationId: "same-organization", direction: "BIDIRECTIONAL", organization: { isActive: true } },
    pass: { organizationId: "same-organization", status: "ACTIVE", validFrom: new Date(0), validUntil: new Date(100000), visit: { approvedAt: new Date(1), status: "PASS_ISSUED" } },
    last: null, now: new Date(10000)
  };
}

test("first scan enters; only authoritative granted entry permits exit", () => {
  const state = validState();
  assert.deepEqual(visitorAccessDecision(state), { direction: "ENTRY", denialReason: null });
  state.last = { direction: "ENTRY", scannedAt: new Date(7000) };
  state.pass!.visit.status = "INSIDE";
  assert.deepEqual(visitorAccessDecision(state), { direction: "EXIT", denialReason: null });
});

test("explicit exit before entry and repeated entry are denied", () => {
  const state = validState();
  state.requestedDirection = "EXIT";
  assert.equal(visitorAccessDecision(state).denialReason, "ANTI_PASSBACK");
  state.last = { direction: "ENTRY", scannedAt: new Date(7000) };
  state.pass!.visit.status = "INSIDE";
  state.requestedDirection = "ENTRY";
  assert.equal(visitorAccessDecision(state).denialReason, "ANTI_PASSBACK");
});

test("rapid repeat cannot toggle an entry into an immediate exit", () => {
  const state = validState();
  state.last = { direction: "ENTRY", scannedAt: new Date(9999) };
  state.pass!.visit.status = "INSIDE";
  assert.equal(visitorAccessDecision(state).denialReason, "SCAN_TOO_SOON");
  state.now = new Date(11999);
  assert.equal(visitorAccessDecision(state).denialReason, null);
});

test("inactive passes cannot enter, but an inside visitor can still exit safely", () => {
  for (const status of ["USED", "REVOKED", "EXPIRED", "CANCELLED"]) {
    const state = validState();
    state.pass!.status = status;
    assert.equal(visitorAccessDecision(state).denialReason, `PASS_${status}`);
  }

  const entry = validState();
  entry.now = entry.pass!.validUntil;
  assert.equal(visitorAccessDecision(entry).denialReason, "OUTSIDE_VALID_TIME");
  entry.now = new Date(-1);
  assert.equal(visitorAccessDecision(entry).denialReason, "OUTSIDE_VALID_TIME");

  const exit = validState();
  exit.pass!.status = "EXPIRED";
  exit.pass!.validUntil = new Date(9000);
  exit.pass!.visit.status = "INSIDE";
  exit.last = { direction: "ENTRY", scannedAt: new Date(7000) };
  exit.now = new Date(10000);
  assert.deepEqual(visitorAccessDecision(exit), { direction: "EXIT", denialReason: null });
});

test("approval cannot be bypassed and terminal visits cannot enter", () => {
  for (const status of ["PENDING_APPROVAL", "APPROVED", "REJECTED", "REVOKED", "CANCELLED", "CHECKED_OUT"]) {
    const state = validState(); state.pass!.visit.status = status;
    assert.equal(visitorAccessDecision(state).denialReason, "VISIT_NOT_ACTIVE");
  }
  const state = validState(); state.pass!.visit.approvedAt = null;
  assert.equal(visitorAccessDecision(state).denialReason, "VISIT_NOT_ACTIVE");
});

test("building, membership, organization and gate restrictions fail closed", () => {
  const state = validState(); state.buildingActive = false;
  assert.equal(visitorAccessDecision(state).denialReason, "BUILDING_INACTIVE");
  state.buildingActive = true; state.membershipActive = false;
  assert.equal(visitorAccessDecision(state).denialReason, "ORGANIZATION_INACTIVE");
  state.membershipActive = true; state.gate!.organizationId = "another-organization";
  assert.equal(visitorAccessDecision(state).denialReason, "WRONG_GATE");
  state.gate!.organizationId = state.pass!.organizationId; state.gate!.direction = "EXIT";
  assert.equal(visitorAccessDecision(state).denialReason, "WRONG_GATE_DIRECTION");
  state.gate!.status = "OFFLINE";
  assert.equal(visitorAccessDecision(state).denialReason, "GATE_UNAVAILABLE");
});

test("software scanning can validate at an active checkpoint before turnstile hardware is installed", () => {
  const state = validState();
  state.hardwareAvailable = false;
  state.gate!.status = "OFFLINE";
  assert.deepEqual(visitorAccessDecision(state), { direction: "ENTRY", denialReason: null });
  state.gate!.isActive = false;
  assert.equal(visitorAccessDecision(state).denialReason, "GATE_UNAVAILABLE");
});

test("physical hardware mode fails closed when the gate controller is offline", () => {
  const state = validState();
  state.hardwareAvailable = true;
  state.gate!.status = "OFFLINE";
  assert.equal(visitorAccessDecision(state).denialReason, "GATE_UNAVAILABLE");
});

test("unknown credentials and inconsistent visit/event state are denied", () => {
  const state = validState(); state.pass!.visit.status = "INSIDE";
  assert.equal(visitorAccessDecision(state).denialReason, "STATE_MISMATCH");
  state.pass = null;
  assert.equal(visitorAccessDecision(state).denialReason, "UNKNOWN_PASS");
  state.formatValid = false;
  assert.equal(visitorAccessDecision(state).denialReason, "INVALID_QR_FORMAT");
});
