export type PermanentPassHolderType =
  | "EMPLOYEE"
  | "SECURITY"
  | "CLEANER"
  | "CONTRACTOR"
  | "TENANT"
  | "VENDOR"
  | "OTHER";

export type PermanentPassStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "EXPIRED"
  | "REVOKED";

export type PermanentPassExpiryType =
  | "LIFETIME"
  | "FIXED_DATE";

export type PermanentPassActivityType =
  | "ENTRY"
  | "EXIT";

export type PermanentPassVehicle = {
  id: string;
  plateNumber: string;
  normalizedPlateNumber: string;
  isActive: boolean;
  isCurrentlyInside: boolean;
  lastEntryAt?: string | null;
  lastExitAt?: string | null;
};

export type PermanentPass = {
  id: string;

  organizationId: string;
  organizationName?: string | null;

  passNumber: string;
  qrToken?: string | null;
  qrCodeUrl?: string | null;

  fullName: string;
  staffNumber?: string | null;

  department?: string | null;
  position?: string | null;

  holderType: PermanentPassHolderType;
  status: PermanentPassStatus;

  phone?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  vehicle?: PermanentPassVehicle | null;

  validFrom: string;
  expiryType: PermanentPassExpiryType;
  expiresAt?: string | null;

  isCurrentlyInside: boolean;

  lastActivityType?: PermanentPassActivityType | null;
  lastActivityAt?: string | null;

  createdAt: string;
  updatedAt?: string | null;
};

export type PermanentPassPaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PermanentPassListResponse = {
  data: PermanentPass[];
  meta: PermanentPassPaginationMeta;
};

export type PermanentPassQueryParams = {
  search?: string;
  status?: PermanentPassStatus | "";
  holderType?: PermanentPassHolderType | "";
  organizationId?: string;
  page?: number;
  pageSize?: number;
};

export type CreatePermanentPassPayload = {
  organizationId: string;
  fullName: string;

  staffNumber?: string;

  department: string;
  position?: string;

  holderType: PermanentPassHolderType;

  phone?: string;
  email?: string;

  photoDataUrl?: string;
  vehiclePlateNumber?: string;

  validFrom: string;
  expiryType: PermanentPassExpiryType;
  expiresAt?: string;
};

export type CreatePermanentPassResponse = {
  data: PermanentPass;
  message?: string;
};


export type UpdatePermanentPassPayload = {
  fullName?: string;

  staffNumber?: string | null;

  department?: string;

  position?: string | null;

  holderType?: PermanentPassHolderType;

  phone?: string | null;

  email?: string | null;
  vehiclePlateNumber?: string | null;
};
export type UpdatePermanentPassStatusPayload = {
  status: PermanentPassStatus;
  reason?: string;
};

export type ReplacePermanentPassPayload = {
  reason: string;
};

export type ReplacePermanentPassResponse = {
  data: PermanentPass;
  message?: string;
};