import { apiRequest } from "./api-client";

export type OwnerBuilding = {
  id: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  adminUsername?: string | null;
  mustChangePassword: boolean;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  isActive: boolean;
  provisionedAt?: string | null;
  activatedAt?: string | null;
  createdAt: string;
  counts: {
    organizations: number;
    kiosks: number;
  };
};

export function getOwnerBuildings() {
  return apiRequest<{ success: boolean; data: OwnerBuilding[] }>("/auth/buildings");
}

export function provisionBuilding(payload: {
  name: string;
  code: string;
  address?: string;
  city?: string;
  country?: string;
  adminUsername: string;
  temporaryPassword: string;
}) {
  return apiRequest<{ success: boolean; data: OwnerBuilding }>("/auth/buildings", {
    method: "POST",
    body: payload
  });
}


export function updateOwnerBuilding(
  siteId: string,
  payload: {
    name: string;
    code: string;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    adminUsername?: string | null;
    status?: "PENDING" | "ACTIVE" | "SUSPENDED";
    isActive?: boolean;
  }
) {
  return apiRequest<{ success: boolean; data: OwnerBuilding }>(`/auth/buildings/${siteId}`, {
    method: "PATCH",
    body: payload
  });
}

export function deleteOwnerBuilding(siteId: string) {
  return apiRequest<{ success: boolean; data: { id: string } }>(`/auth/buildings/${siteId}`, {
    method: "DELETE"
  });
}
