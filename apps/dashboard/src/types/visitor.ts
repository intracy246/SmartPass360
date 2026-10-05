export type VisitorType =
  | "WALK_IN"
  | "EXPECTED"
  | "CONTRACTOR"
  | "SUPPLIER"
  | "DELIVERY"
  | "INTERVIEW_CANDIDATE"
  | "GOVERNMENT_OFFICIAL"
  | "VIP";

export type CreateVisitorPayload = {
  fullName: string;
  idType?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  company?: string;
  vehicleNumber?: string;
};

export type CreateVisitPayload = {
  visitor: CreateVisitorPayload;
  visitorType: VisitorType;
  hostId?: string;
  departmentId?: string;
  purpose: string;
  scheduledDate?: string;
  expectedEntryTime?: string;
  expectedExitTime?: string;
};

export type VisitorRegistrationResponse = {
  success: boolean;
  data: {
    visitorId: string;
    visitId: string;
    status: string;
    passNumber?: string;
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