import { apiRequest } from "./api-client";

import type {
  PassListResponse,
  PassQueryParams
} from "../types/pass";

function buildQueryString(
  params: PassQueryParams
) {
  const searchParams = new URLSearchParams();

  if (params.search?.trim()) {
    searchParams.set(
      "search",
      params.search.trim()
    );
  }

  if (params.status) {
    searchParams.set("status", params.status);
  }

  if (params.source) {
    searchParams.set("source", params.source);
  }

  searchParams.set(
    "page",
    String(params.page ?? 1)
  );

  searchParams.set(
    "pageSize",
    String(params.pageSize ?? 20)
  );

  return searchParams.toString();
}

export function getPasses(
  params: PassQueryParams
): Promise<PassListResponse> {
  const queryString = buildQueryString(params);

  return apiRequest<PassListResponse>(
    `/passes?${queryString}`
  );
}