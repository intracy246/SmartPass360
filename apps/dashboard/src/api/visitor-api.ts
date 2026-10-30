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


export type IntelligentSearchResult = {
  id: string;
  recordType: "VISITOR" | "PERMANENT_PASS";
  fullName: string;
  phone: string | null;
  company: string | null;
  vehicleNumber: string | null;
  organizationName: string | null;
  department: string | null;
  hostName: string | null;
  purpose: string | null;
  passNumber: string | null;
  status: string;
  createdAt: string;
  lastActivityAt: string | null;
};

export function searchPeople(query: string) {
  return apiRequest<{
    success: boolean;
    data: IntelligentSearchResult[];
    meta: { total: number; query: string };
  }>(`/visitors/search?q=${encodeURIComponent(query)}`);
}


export type IssuedVisitorTicket = {
  passNumber: string;
  qrValue: string;
  fullName: string;
  organizationName: string;
  departmentOrOffice?: string | null;
  hostName?: string | null;
  purpose?: string | null;
  issuedAt: string;
  validFrom: string;
  validUntil: string;
};

export function approveAndIssueVisitorPass(visitId: string) {
  return apiRequest<{ success: boolean; data: { pass: IssuedVisitorTicket } }>(
    `/visitors/${encodeURIComponent(visitId)}/approve-and-issue`,
    { method: "POST" }
  );
}
