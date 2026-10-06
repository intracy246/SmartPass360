import { apiRequest } from "./api-client";

export type AuthorizedVehicle = {
  id: string;
  plateNumber: string;
  normalizedPlateNumber: string;
  isActive: boolean;
  isCurrentlyInside: boolean;
  lastEntryAt?: string | null;
  lastExitAt?: string | null;
};

export type VehicleAccessRequest = {
  id: string;
  plateNumber: string;
  normalizedPlateNumber: string;
  direction: "ENTRY" | "EXIT";
  confidence?: number | null;
  snapshotUrl?: string | null;
  status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";
  reason: string;
  detectedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  gate?: {
    id: string;
    name: string;
    code?: string;
  } | null;
};

export type VehicleAccessEvent = {
  id: string;
  plateNumber: string;
  direction: "ENTRY" | "EXIT";
  decision: "AUTHORIZED" | "UNKNOWN" | "APPROVED" | "DENIED";
  action: "UNLOCK" | "KEEP_LOCKED";
  reason: string;
  confidence?: number | null;
  occurredAt: string;
  holderName?: string | null;
  organizationName?: string | null;
  gateName?: string | null;
};

export function getVehicles() {
  return apiRequest<{ data: AuthorizedVehicle[] }>("/vehicle-access/vehicles");
}

export function getVehicleRequests() {
  return apiRequest<{ data: VehicleAccessRequest[] }>("/vehicle-access/requests");
}

export function getVehicleEvents(page = 1, pageSize = 50) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiRequest<{ data: VehicleAccessEvent[] }>(`/vehicle-access/events?${query.toString()}`);
}

export function approveVehicleRequest(requestId: string) {
  return apiRequest<{ data: VehicleAccessRequest; action: "UNLOCK" }>(
    `/vehicle-access/requests/${encodeURIComponent(requestId)}/approve`,
    { method: "POST" }
  );
}

export function denyVehicleRequest(requestId: string) {
  return apiRequest<{ data: VehicleAccessRequest; action: "KEEP_LOCKED" }>(
    `/vehicle-access/requests/${encodeURIComponent(requestId)}/deny`,
    { method: "POST" }
  );
}
