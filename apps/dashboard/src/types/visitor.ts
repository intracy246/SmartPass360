export type VisitorType =
  | "WALK_IN"
  | "EXPECTED"
  | "CONTRACTOR"
  | "SUPPLIER"
  | "DELIVERY"
  | "INTERVIEW_CANDIDATE"
  | "GOVERNMENT_OFFICIAL"
  | "VIP";

export type VisitorIdentificationType =
  | "NONE"
  | "NATIONAL_ID"
  | "PASSPORT"
  | "DRIVING_LICENCE"
  | "VOTER_ID"
  | "OTHER";

export type CreateVisitPayload = {
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
};

export type IssuedVisitorPass = {
  passNumber: string;
  qrValue: string;
  issuedAt: string;
  validFrom: string;
  validUntil: string;
};

export type VisitorRegistrationResponse = {
  success: boolean;
  data: {
    visitorId: string;
    visitId: string;
    status: "PASS_ISSUED";
    source: "RECEPTION";
    pass: IssuedVisitorPass;
  };
};

export type VisitorPassPreviewData = {
  fullName: string;
  company?: string;
  visitorType: VisitorType;
  hostName?: string;
  departmentName?: string;
  purpose: string;
  scheduledDate?: string;
  expectedEntryTime?: string;
  expectedExitTime?: string;
  passNumber?: string;
  status:
    | "DRAFT"
    | "WAITING"
    | "APPROVED"
    | "ACTIVE"
    | "INSIDE"
    | "EXITED"
    | "EXPIRED"
    | "DENIED";
  photoUrl?: string;
  qrValue?: string;
};
