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

