export type VisitorIdentificationType =
  | "NATIONAL_ID"
  | "PASSPORT"
  | "DRIVING_LICENCE"
  | "VOTER_ID"
  | "OTHER"
  | "NONE";

export type KioskRegistrationPayload = {
  organizationId: string;

  fullName: string;

  phoneNumber: string;

  identificationType: VisitorIdentificationType;

  identificationNumber?: string;

  companyName?: string;

  vehicleRegistrationNumber?: string;

  departmentOrOffice: string;

  hostName: string;

  purposeOfVisit: string;

  photoDataUrl?: string;

  source: "KIOSK";
};

export type KioskRegistrationResult = {
  success: boolean;

  data: {
    visitorId: string;

    visitId: string;

    referenceNumber: string;

    status: "WAITING_APPROVAL";

    registeredAt: string;
  };
};

export type OrganizationOption = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type OrganizationOptionResponse = {
  success: boolean;
  data: OrganizationOption[];
};