import { apiRequest } from "./api-client";

import type {
  CreateOrganizationPayload,
  CreateOrganizationResponse,
  OrganizationListResponse
} from "../types/organization";

export function getOrganizations(
  search = "",
  page = 1,
  pageSize = 20
): Promise<OrganizationListResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });

  if (search.trim()) {
    searchParams.set("search", search.trim());
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