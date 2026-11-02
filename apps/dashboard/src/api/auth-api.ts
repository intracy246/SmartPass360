import { apiRequest } from "./api-client";

export type AuthUser = {
  scope: "OWNER" | "BUILDING";
  siteId?: string;
  username: string;
  mustChangePassword?: boolean;
  guardName?: string;
  guardSessionId?: string;
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


export function identifyGuard(fullName: string) {
  return apiRequest<LoginResponse>("/auth/identify-guard", {
    method: "POST",
    body: { fullName }
  });
}

export type GuardSession = {
  id: string;
  guardName: string;
  username: string;
  loginAt: string;
  lastSeenAt: string;
  loggedOutAt: string | null;
  isOnline: boolean;
};

export function getGuardSessions() {
  return apiRequest<{ success: boolean; data: GuardSession[] }>("/auth/guard-sessions");
}

export function heartbeatGuardSession() {
  return apiRequest<{ success: boolean; data: { lastSeenAt: string } }>("/auth/guard-sessions/heartbeat", { method: "POST" });
}

export function logoutGuardSession() {
  return apiRequest<{ success: boolean; data: { loggedOut: boolean } }>("/auth/logout", { method: "POST" });
}
