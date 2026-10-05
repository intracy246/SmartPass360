import { apiRequest } from "./api-client";

import type {
  KioskRegistrationPayload,
  KioskRegistrationResult,
  OrganizationOptionResponse,
  KioskBuildingConfigResponse,
  KioskVisitStatus,
  KioskIssuedPass
} from "../types/kiosk";

export function activateKiosk(payload: { activationCode: string; deviceId: string }) {
  return apiRequest<KioskBuildingConfigResponse>("/kiosks/activate", {
    method: "POST",
    body: payload
  });
}

export function getKioskOrganizations() {
  return apiRequest<OrganizationOptionResponse>(
    "/organizations?active=true&pageSize=100"
  );
}

export function registerVisitorFromKiosk(
  payload: KioskRegistrationPayload
) {
  return apiRequest<KioskRegistrationResult>(
    "/visitors/kiosk-registration",
    {
      method: "POST",
      headers: deviceHeaders(),
      body: payload
    }
  );
}

function deviceHeaders() {
  return { "x-kiosk-device-id": window.localStorage.getItem("smartpass360.deviceId") ?? "" };
}

export function getKioskVisitStatus(visitId: string, receiptToken: string) {
  return apiRequest<{ success: boolean; data: KioskVisitStatus }>(`/visitors/${visitId}/kiosk-status`, {
    method: "POST", headers: deviceHeaders(),
    body: { kioskId: window.localStorage.getItem("smartpass360.kioskId"), receiptToken }
  });
}

export function issueKioskPass(visitId: string, receiptToken: string) {
  return apiRequest<{ success: boolean; data: KioskIssuedPass }>(`/visitors/${visitId}/kiosk-pass`, {
    method: "POST", headers: deviceHeaders(),
    body: { kioskId: window.localStorage.getItem("smartpass360.kioskId"), receiptToken }
  });
}

export function getRegisteredKioskConfig(kioskId: string) {
  const deviceId = window.localStorage.getItem("smartpass360.deviceId");

  return apiRequest<KioskBuildingConfigResponse>(
    `/kiosks/${kioskId}/config`,
    {
      headers: deviceId ? { "x-kiosk-device-id": deviceId } : undefined
    }
  );
}
