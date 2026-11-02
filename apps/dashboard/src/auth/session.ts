import type { AuthUser } from "../api/auth-api";

const TOKEN_KEY = "smartpass360.token";
const USER_KEY = "smartpass360.user";
const BUILDING_KEY = "smartpass360.building";

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}

export function saveSession(token: string, user: AuthUser) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (user.scope === "BUILDING") window.localStorage.setItem(BUILDING_KEY, user.siteId ?? "");
  else window.localStorage.removeItem(BUILDING_KEY);
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(BUILDING_KEY);
}

export async function signOutSession() {
  try {
    const user = getStoredUser();
    if (user?.scope === "BUILDING" && user.guardSessionId) {
      const { logoutGuardSession } = await import("../api/auth-api");
      await logoutGuardSession();
    }
  } catch {
    // Always clear the local session even when the API is unreachable.
  } finally {
    clearSession();
  }
}
