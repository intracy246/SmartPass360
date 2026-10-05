const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

// Development has one transport: same-origin Vite proxy to the local API.
// A stale .env URL must not silently bypass that proxy.
const API_BASE_URL =
  !import.meta.env.DEV && configuredApiBaseUrl
    ? configuredApiBaseUrl.replace(/\/+$/, "")
    : "/api/v1";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(
    message: string,
    status: number,
    details?: unknown
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers
      },
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body)
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    throw new ApiError(`Cannot reach SmartPass360 API at ${url}. Check the connection and that the API is running.`, 0);
  }

  let responseBody: unknown = null;

  const contentType =
    response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      responseBody = await response.json();
    } catch {
      throw new ApiError(`SmartPass360 API returned invalid JSON (HTTP ${response.status}).`, response.status);
    }
  }

  if (responseBody === null) {
    throw new ApiError(`SmartPass360 API returned a non-JSON response (HTTP ${response.status}). Check the API server configuration.`, response.status);
  }

  if (!response.ok) {
    const errorBody = responseBody as {
      message?: string;
      error?: {
        message?: string;
        code?: string;
      };
    } | null;

    throw new ApiError(
      errorBody?.error?.message ??
        errorBody?.message ??
        `SmartPass360 API returned HTTP ${response.status}.`,
      response.status,
      responseBody
    );
  }

  return responseBody as T;
}
