import { apiRequest } from "./api-client";
import type { Organization } from "../types/organization";

export type OrganizationCatalogItem = { id: string; name: string; code?: string; isSystem?: boolean };

export function getOrganizationDepartments(organizationId: string) {
  return apiRequest<{ success: boolean; data: OrganizationCatalogItem[] }>(`/organizations/${encodeURIComponent(organizationId)}/departments`);
}
export function addOrganizationDepartment(organizationId: string, name: string) {
  return apiRequest<{ success: boolean; data: OrganizationCatalogItem }>(`/organizations/${encodeURIComponent(organizationId)}/departments`, { method: "POST", body: { name } });
}
export function deleteOrganizationDepartment(organizationId: string, departmentId: string) {
  return apiRequest<{ success: boolean }>(`/organizations/${encodeURIComponent(organizationId)}/departments/${encodeURIComponent(departmentId)}`, { method: "DELETE" });
}
export function getOrganizationPurposes(organizationId: string) {
  return apiRequest<{ success: boolean; data: OrganizationCatalogItem[] }>(`/organizations/${encodeURIComponent(organizationId)}/purposes`);
}
export function addOrganizationPurpose(organizationId: string, name: string) {
  return apiRequest<{ success: boolean; data: OrganizationCatalogItem }>(`/organizations/${encodeURIComponent(organizationId)}/purposes`, { method: "POST", body: { name } });
}
export function deleteOrganizationPurpose(organizationId: string, purposeId: string) {
  return apiRequest<{ success: boolean }>(`/organizations/${encodeURIComponent(organizationId)}/purposes/${encodeURIComponent(purposeId)}`, { method: "DELETE" });
}
