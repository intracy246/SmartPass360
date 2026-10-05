import { apiRequest } from "./api-client";

export type HealthResponse = {
  success: boolean;
  service: string;
  version: string;
  status: string;
  environment: string;
  timestamp: string;
};

export function getApiHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/health");
}