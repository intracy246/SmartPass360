import { apiRequest } from "./api-client";

import type {
  CreateVisitPayload,
  VisitorRegistrationResponse
} from "../types/visitor";

export function registerVisitor(
  payload: CreateVisitPayload
): Promise<VisitorRegistrationResponse> {
  return apiRequest<VisitorRegistrationResponse>(
    "/visitors/register",
    {
      method: "POST",
      body: payload
    }
  );
}

export type OperationalVisit = {
  id: string;
  visitorId: string;
  fullName: string;
  phone?: string | null;
  company?: string | null;
  vehicleNumber?: string | null;
  organization: { id: string; name: string };
  departmentOrOffice?: string | null;
  hostName?: string | null;
  purpose: string;
  registeredAt: string;
  source: string;
  status: string;
  approvedAt?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  pass?: {
    id: string;
    passNumber: string;
    status: string;
    validUntil: string;
  } | null;
};

export function getVisitorOperations() {
  return apiRequest<{
    success: boolean;
    data: { pending: OperationalVisit[]; inside: OperationalVisit[] };
  }>("/visitors/operations");
}

export function approveVisitor(visitId: string) {
  return apiRequest<{ success: boolean; data: { id: string; status: string } }>(
    `/visitors/${encodeURIComponent(visitId)}/approve`,
    { method: "POST" }
  );
}

export function denyVisitor(visitId: string) {
  return apiRequest<{ success: boolean; data: { id: string; status: string } }>(
    `/visitors/${encodeURIComponent(visitId)}/deny`,
    { method: "POST" }
  );
}

export function checkOutVisitor(visitId: string) {
  return apiRequest<{ success: boolean; data: { id: string; status: string; checkedOutAt: string } }>(
    `/visitors/${encodeURIComponent(visitId)}/check-out`,
    { method: "POST" }
  );
}
