export type AccessDirection =
  | "ENTRY"
  | "EXIT";

export type AccessDecision =
  | "GRANTED"
  | "DENIED";

export type AccessEventReason =
  | "VALID_PASS"
  | "PASS_EXPIRED"
  | "PASS_REVOKED"
  | "PASS_NOT_ACTIVE"
  | "ANTI_PASSBACK"
  | "OUTSIDE_VALID_TIME"
  | "WRONG_GATE"
  | "UNKNOWN_PASS"
  | "MANUAL_OVERRIDE"
  | "SYSTEM_ERROR";

export type AccessValidationPayload = {
  credential: string;
  gateId: string;
  direction?: AccessDirection;
  requestId?: string;
};

export type AccessValidationResult = {
  success: boolean;
  data: {
    decision: AccessDecision;
    reason: AccessEventReason;
    eventId?: string;
    passId?: string;
    passNumber?: string;
    visitorName?: string;
    visitorPhotoUrl?: string;
    hostName?: string;
    departmentName?: string;
    direction: AccessDirection;
    gateName?: string;
    timestamp: string;
    message: string;
    turnstileCommand: "UNLOCK" | "KEEP_LOCKED";
  };
};

export type AccessEvent = {
  id: string;
  passNumber?: string;
  visitorName?: string;
  visitorPhotoUrl?: string;
  gateName?: string;
  direction: AccessDirection;
  decision: AccessDecision;
  reason: AccessEventReason;
  occurredAt: string;
};

export type AccessEventListResponse = {
  success: boolean;
  data: AccessEvent[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
export type PermanentPassScanPayload = {
  qrCode: string;
  gateId: string;
};

export type PermanentPassScanResult = {
  decision: "GRANTED" | "DENIED";
  denialReason?: string;
  activityType?: "ENTRY" | "EXIT";
  turnstileCommand: "UNLOCK" | "KEEP_LOCKED";
  accessEventId?: string;
  gate?: {
    id: string;
    code: string;
    name: string;
  };
  holder?: {
    passNumber: string;
    fullName: string;
  };
};
