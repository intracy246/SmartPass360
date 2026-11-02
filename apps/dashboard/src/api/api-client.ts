import { environment } from "../config/environment";

export class ApiError extends Error {
  public readonly status: number;
  public readonly details: unknown;
  constructor(message: string, status: number, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

const TOKEN_KEY = "smartpass360.token";
const USER_KEY = "smartpass360.user";
const BUILDING_KEY = "smartpass360.building";

function clearStaleSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(BUILDING_KEY);
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const method = options.method?.toUpperCase() ?? "GET";
  const isLogin = method === "POST" && normalizedEndpoint === "/auth/login";
  const token = isLogin ? null : window.localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");

  const response = await fetch(`${environment.apiBaseUrl}${normalizedEndpoint}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const contentType = response.headers.get("content-type");
  const responseBody = contentType?.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    // Do not preserve an invalid local bearer token after the API rejects it.
    if (!isLogin && (response.status === 401 || (response.status === 403 && normalizedEndpoint === "/auth/identify-guard"))) {
      clearStaleSession();
    }
    const message = typeof responseBody === "object" && responseBody !== null && "error" in responseBody
      ? extractErrorMessage(responseBody)
      : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, responseBody);
  }
  return responseBody as T;
}

function extractErrorMessage(responseBody: object): string {
  const errorValue = Reflect.get(responseBody, "error");
  if (typeof errorValue === "object" && errorValue !== null) {
    const message = Reflect.get(errorValue, "message");
    if (typeof message === "string") return message;
  }
  return "The server rejected the request.";
}
