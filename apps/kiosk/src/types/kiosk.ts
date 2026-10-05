export type VisitorIdentificationType =
  | "NATIONAL_ID"
  | "PASSPORT"
  | "DRIVING_LICENCE"
  | "VOTER_ID"
  | "OTHER"
  | "NONE";

export type KioskRegistrationPayload = {
  kioskId: string;

  organizationId: string;

  fullName: string;

  phoneNumber: string;

  identificationType: VisitorIdentificationType;

  identificationNumber?: string;

  companyName?: string;

  vehicleRegistrationNumber?: string;

  departmentOrOffice?: string;

  hostName?: string;

  purposeOfVisit?: string;

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
    receiptToken: string;
  };
};

export type KioskVisitStatus = {
  id: string; status: string; fullName: string; source: string;
};

export type KioskIssuedPass = {
  passId: string; passNumber: string; fullName: string;
  site: { id: string; name: string; logoUrl?: string | null };
  organization: { id: string; name: string };
  departmentOrOffice?: string | null; hostName?: string | null; purpose: string;
  issuedAt: string; validFrom: string; validUntil: string; qrValue: string;
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

export type KioskBuildingConfigResponse = {
  success: boolean;
  data: {
    kiosk: {
      id: string;
      name: string;
      code: string;
      location?: string | null;
    };
    site: {
      id: string;
      name: string;
      code: string;
      logoUrl?: string | null;
    };
    organizations: OrganizationOption[];
  };
};
