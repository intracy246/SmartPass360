import { apiRequest } from "./api-client";

import type {
  CreateVisitPayload,
  VisitorRegistrationResponse
} from "../types/visitor";

export function registerVisitor(
  payload: CreateVisitPayload
): Promise<VisitorRegistrationResponse> {
  return apiRequest<VisitorRegistrationResponse>(
    "/visitors/register",
    {
      method: "POST",
      body: payload
    }
  );
}