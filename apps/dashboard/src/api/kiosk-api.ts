import { apiRequest } from "./api-client";

export type KioskRecord = {
  id: string;
  siteId: string;
  name: string;
  code: string;
  location?: string | null;
  activationCode: string;
  deviceId?: string | null;
  isActive: boolean;
  activatedAt?: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
  site: {
    id: string;
    name: string;
    code: string;
  };
};

type KioskListResponse = {
  success: boolean;
  data: KioskRecord[];
};

type KioskResponse = {
  success: boolean;
  data: KioskRecord;
};

export function getKiosks() {
  return apiRequest<KioskListResponse>("/kiosks");
}

export function createKiosk(payload: {
  name: string;
  code: string;
  location?: string;
}) {
  return apiRequest<KioskResponse>("/kiosks", {
    method: "POST",
    body: payload
  });
}


export function updateKiosk(
  kioskId: string,
  payload: {
    name: string;
    code: string;
    location?: string | null;
    isActive?: boolean;
  }
) {
  return apiRequest<KioskResponse>(`/kiosks/${kioskId}`, {
    method: "PATCH",
    body: payload
  });
}

export function deleteKiosk(kioskId: string) {
  return apiRequest<{ success: boolean; data: { id: string } }>(`/kiosks/${kioskId}`, {
    method: "DELETE"
  });
}
