import { apiRequest } from "./api-client";

import type {
  KioskRegistrationPayload,
  KioskRegistrationResult,
  OrganizationOptionResponse,
  KioskBuildingConfigResponse
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
      body: payload
    }
  );
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
