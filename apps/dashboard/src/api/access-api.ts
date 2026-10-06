import { apiRequest } from "./api-client";

import type {
  AccessEventListResponse,
  AccessValidationPayload,
  AccessValidationResult,
  PermanentPassScanPayload,
  PermanentPassScanResult
} from "../types/access";

export function validateAccess(
  payload: AccessValidationPayload
): Promise<AccessValidationResult> {
  return apiRequest<AccessValidationResult>(
    "/access/validate",
    {
      method: "POST",
      body: payload
    }
  );
}

export function getAccessEvents(
  page = 1,
  pageSize = 20
): Promise<AccessEventListResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });

  return apiRequest<AccessEventListResponse>(
    `/access/events?${searchParams.toString()}`
  );
}

export function getVisitorGates() {
  return apiRequest<{ data: { id: string; name: string; direction: string; isActive: boolean; status: string }[] }>("/access/gates");
}
export function scanPermanentPass(
  payload: PermanentPassScanPayload
): Promise<PermanentPassScanResult> {
  return apiRequest<PermanentPassScanResult>(
    "/access/permanent-pass/scan",
    {
      method: "POST",
      body: payload
    }
  );
}


export type GateSetup = {
  id: string;
  code: string;
  name: string;
  location?: string | null;
  direction: "ENTRY" | "EXIT" | "BIDIRECTIONAL";
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE";
  isActive: boolean;
  organization?: { id: string; name: string } | null;
};

export type GateDevice = {
  id: string;
  name: string;
  isActive: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
  gate: {
    id: string;
    code: string;
    name: string;
    direction: string;
    status: string;
  };
};

export function getGateSetups() {
  return apiRequest<{ success: boolean; data: GateSetup[] }>("/access/gates");
}

export function createGate(payload: {
  organizationId: string;
  code: string;
  name: string;
  location?: string;
  direction: "ENTRY" | "EXIT" | "BIDIRECTIONAL";
}) {
  return apiRequest<{ success: boolean; data: GateSetup }>("/access/gates", {
    method: "POST",
    body: payload
  });
}

export function updateGate(
  gateId: string,
  payload: Partial<Pick<GateSetup, "name" | "location" | "direction" | "status" | "isActive">>
) {
  return apiRequest<{ success: boolean; data: GateSetup }>(
    `/access/gates/${encodeURIComponent(gateId)}`,
    { method: "PATCH", body: payload }
  );
}

export function getGateDevices() {
  return apiRequest<{ success: boolean; data: GateDevice[] }>("/access/gate-devices");
}

export function createGateDevice(gateId: string, name: string) {
  return apiRequest<{
    success: boolean;
    data: {
      id: string;
      name: string;
      gateId: string;
      isActive: boolean;
      deviceKey: string;
      createdAt: string;
    };
    message: string;
  }>(`/access/gates/${encodeURIComponent(gateId)}/devices`, {
    method: "POST",
    body: { name }
  });
}

export function setGateDeviceActive(deviceId: string, isActive: boolean) {
  return apiRequest<{ success: boolean; data: GateDevice }>(
    `/access/gate-devices/${encodeURIComponent(deviceId)}`,
    { method: "PATCH", body: { isActive } }
  );
}

export function rotateGateDeviceKey(deviceId: string) {
  return apiRequest<{
    success: boolean;
    data: { id: string; name: string; deviceKey: string };
    message: string;
  }>(`/access/gate-devices/${encodeURIComponent(deviceId)}/rotate-key`, {
    method: "POST"
  });
}


export type OperationsSummary = {
  visitorsInside: number;
  activePasses: number;
  accessEventsToday: number;
  gatesOnline: number;
  peopleInside: Array<{
    id: string;
    passNumber: string;
    fullName: string;
    department: string;
    lastActivityAt?: string | null;
    organization: { name: string };
  }>;
  recentActivity: Array<{
    id: string;
    kind: "VISITOR" | "PERMANENT_PASS";
    name: string;
    passNumber?: string | null;
    direction: "ENTRY" | "EXIT";
    decision: "GRANTED" | "DENIED" | "ERROR";
    gateName?: string | null;
    occurredAt: string;
  }>;
};

export function getOperationsSummary() {
  return apiRequest<{ success: boolean; data: OperationsSummary }>("/access/operations-summary");
}
