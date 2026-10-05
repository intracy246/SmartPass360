export type PassStatus =
  | "DRAFT"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "ACTIVE"
  | "INSIDE"
  | "EXITED"
  | "EXPIRED"
  | "DENIED"
  | "REVOKED";

export type PassSource =
  | "RECEPTION"
  | "KIOSK"
  | "PRE_REGISTRATION";

export type VisitorPass = {
  id: string;
  passNumber: string;
  visitorId: string;
  visitId: string;
  visitorName: string;
  visitorPhotoUrl?: string;
  company?: string;
  visitorType: string;
  hostName?: string;
  departmentName?: string;
  purpose: string;
  source: PassSource;
  status: PassStatus;
  validFrom?: string;
  validUntil?: string;
  enteredAt?: string;
  exitedAt?: string;
  issuedAt: string;
};

export type PassListResponse = {
  success: boolean;
  data: VisitorPass[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type PassQueryParams = {
  search?: string;
  status?: PassStatus | "";
  source?: PassSource | "";
  page?: number;
  pageSize?: number;
};