import { environment } from "../config/environment";

export class ApiError extends Error {
  public readonly status: number;
  public readonly details: unknown;

  constructor(
    message: string,
    status: number,
    details: unknown = null
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const response = await fetch(
    `${environment.apiBaseUrl}${normalizedEndpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body)
    }
  );

  const contentType = response.headers.get("content-type");

  const responseBody = contentType?.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "error" in responseBody
        ? extractErrorMessage(responseBody)
        : `Request failed with status ${response.status}`;

    throw new ApiError(
      message,
      response.status,
      responseBody
    );
  }

  return responseBody as T;
}

function extractErrorMessage(responseBody: object): string {
  const errorValue = Reflect.get(responseBody, "error");

  if (
    typeof errorValue === "object" &&
    errorValue !== null
  ) {
    const message = Reflect.get(errorValue, "message");

    if (typeof message === "string") {
      return message;
    }
  }

  return "The server rejected the request.";
}