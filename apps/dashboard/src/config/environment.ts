const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error(
    "VITE_API_BASE_URL is missing. Add it to apps/dashboard/.env."
  );
}

export const environment = {
  apiBaseUrl
} as const;