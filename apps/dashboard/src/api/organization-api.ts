import { apiRequest } from "./api-client";

import type {
  CreateOrganizationPayload,
  CreateOrganizationResponse,
  OrganizationListResponse
} from "../types/organization";

export function getOrganizations(
  search = "",
  page = 1,
  pageSize = 20,
  active?: boolean
): Promise<OrganizationListResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });

  if (search.trim()) {
    searchParams.set("search", search.trim());
  }

  if (active !== undefined) {
    searchParams.set("active", String(active));
  }

  return apiRequest<OrganizationListResponse>(
    `/organizations?${searchParams.toString()}`
  );
}

export function createOrganization(
  payload: CreateOrganizationPayload
): Promise<CreateOrganizationResponse> {
  return apiRequest<CreateOrganizationResponse>(
    "/organizations",
    {
      method: "POST",
      body: payload
    }
  );
}
