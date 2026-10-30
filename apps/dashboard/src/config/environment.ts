const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

if (!configuredApiBaseUrl) {
  throw new Error(
    "VITE_API_BASE_URL is missing. Configure the deployed dashboard with the API base URL ending in /api/v1."
  );
}

const apiBaseUrl = configuredApiBaseUrl.replace(/\/+$/, "");

if (!/^https?:\/\//i.test(apiBaseUrl) || !apiBaseUrl.endsWith("/api/v1")) {
  throw new Error(
    "VITE_API_BASE_URL must be an absolute HTTP(S) URL ending in /api/v1."
  );
}

export const environment = {
  apiBaseUrl
} as const;
