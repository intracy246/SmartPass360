const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:4000/api/v1";

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
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
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
    }
  );

  let responseBody: unknown = null;

  const contentType =
    response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    responseBody = await response.json();
  }

  if (!response.ok) {
    const errorBody = responseBody as {
      message?: string;
    } | null;

    throw new ApiError(
      errorBody?.message ??
        "The SmartPass360 service returned an error.",
      response.status,
      responseBody
    );
  }

  return responseBody as T;
}