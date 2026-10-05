import { apiRequest } from "./api-client";

export type AuthUser = {
  scope: "OWNER" | "BUILDING";
  siteId?: string;
  username: string;
  mustChangePassword?: boolean;
};

export type LoginResponse = {
  success: boolean;
  data: {
    token: string;
    user: AuthUser;
    building?: {
      id: string;
      name: string;
      code: string;
      status: "PENDING" | "ACTIVE" | "SUSPENDED";
    };
  };
};

export function login(username: string, password: string) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: { username, password }
  });
}

export function changeBuildingPassword(currentPassword: string, newPassword: string) {
  return apiRequest<LoginResponse>("/auth/me/change-password", {
    method: "POST",
    body: { currentPassword, newPassword }
  });
}
