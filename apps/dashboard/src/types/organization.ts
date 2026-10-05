export type OrganizationType =
  | "COMPANY"
  | "GOVERNMENT"
  | "UNIVERSITY"
  | "HOSPITAL"
  | "NGO"
  | "BANK"
  | "OTHER";

export type Organization = {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  organizationType: OrganizationType;
  email?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationListResponse = {
  success: boolean;
  data: Organization[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type CreateOrganizationPayload = {
  code: string;
  name: string;
  shortName?: string;
  organizationType: OrganizationType;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
};

export type CreateOrganizationResponse = {
  success: boolean;
  data: Organization;
};