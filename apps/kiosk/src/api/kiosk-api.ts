import { apiRequest } from "./api-client";

import type {
  KioskRegistrationPayload,
  KioskRegistrationResult,
  OrganizationOptionResponse
} from "../types/kiosk";

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