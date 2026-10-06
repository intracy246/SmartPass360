import {
  apiRequest
} from "./api-client";

import type {
  CreatePermanentPassPayload,
  CreatePermanentPassResponse,
  PermanentPass,
  PermanentPassListResponse,
  PermanentPassQueryParams,
  ReplacePermanentPassPayload,
  ReplacePermanentPassResponse,
  UpdatePermanentPassPayload,
  UpdatePermanentPassStatusPayload
} from "../types/permanent-pass";

function buildQueryString(
  params: PermanentPassQueryParams
) {
  const searchParams = new URLSearchParams();

  if (params.search?.trim()) {
    searchParams.set(
      "search",
      params.search.trim()
    );
  }

  if (params.status) {
    searchParams.set(
      "status",
      params.status
    );
  }

  if (params.holderType) {
    searchParams.set(
      "holderType",
      params.holderType
    );
  }

  if (params.organizationId) {
    searchParams.set(
      "organizationId",
      params.organizationId
    );
  }

  if (params.page) {
    searchParams.set(
      "page",
      String(params.page)
    );
  }

  if (params.pageSize) {
    searchParams.set(
      "pageSize",
      String(params.pageSize)
    );
  }

  const queryString =
    searchParams.toString();

  return queryString
    ? `?${queryString}`
    : "";
}

export function getPermanentPasses(
  params: PermanentPassQueryParams
) {
  return apiRequest<PermanentPassListResponse>(
    `/permanent-passes${buildQueryString(params)}`
  );
}

export function getPermanentPass(
  permanentPassId: string
) {
  return apiRequest<PermanentPass>(
    `/permanent-passes/${encodeURIComponent(
      permanentPassId
    )}`
  );
}

export function createPermanentPass(
  payload: CreatePermanentPassPayload
) {
  return apiRequest<CreatePermanentPassResponse>(
    "/permanent-passes",
    {
      method: "POST",
      body: payload
    }
  );
}


export function updatePermanentPass(
  permanentPassId: string,
  payload: UpdatePermanentPassPayload
) {
  return apiRequest<{
    data: PermanentPass;
    message?: string;
  }>(
    `/permanent-passes/${encodeURIComponent(
      permanentPassId
    )}`,
    {
      method: "PATCH",
      body: payload
    }
  );
}
export function updatePermanentPassStatus(
  permanentPassId: string,
  payload: UpdatePermanentPassStatusPayload
) {
  return apiRequest<PermanentPass>(
    `/permanent-passes/${encodeURIComponent(
      permanentPassId
    )}/status`,
    {
      method: "PATCH",
      body: payload
    }
  );
}

export function replacePermanentPass(
  permanentPassId: string,
  payload: ReplacePermanentPassPayload
) {
  return apiRequest<ReplacePermanentPassResponse>(
    `/permanent-passes/${encodeURIComponent(
      permanentPassId
    )}/replace`,
    {
      method: "POST",
      body: payload
    }
  );
}


export function reprintPermanentPass(
  permanentPassId: string
) {
  return apiRequest<ReplacePermanentPassResponse>(
    `/permanent-passes/${encodeURIComponent(
      permanentPassId
    )}/reprint`,
    {
      method: "POST"
    }
  );
}
