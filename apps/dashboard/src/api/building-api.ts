import { apiRequest } from "./api-client";

export type BuildingSettings = {
  id: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  isActive: boolean;
};

type BuildingListResponse = {
  success: boolean;
  data: BuildingSettings[];
};

type BuildingResponse = {
  success: boolean;
  data: BuildingSettings;
};

export function getBuildings() {
  return apiRequest<BuildingListResponse>("/kiosks/sites");
}

export function updateBuildingSettings(
  siteId: string,
  payload: { name: string; logoUrl?: string | null }
) {
  return apiRequest<BuildingResponse>(
    `/kiosks/sites/${siteId}/settings`,
    {
      method: "PATCH",
      body: payload
    }
  );
}
