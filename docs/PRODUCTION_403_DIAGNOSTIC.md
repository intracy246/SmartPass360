# SmartPass360 production 403 diagnostic runbook

## What the dashboard source confirms

The dashboard calls these API paths:

- `GET /api/v1/access/operations-summary`
- `GET /api/v1/vehicle-access/requests`

Both endpoints use the `requireBuilding` middleware. That middleware returns HTTP 403 with `FORBIDDEN / Building access required.` whenever the bearer token is missing, its HMAC signature cannot be verified, it has expired, the token scope is not `BUILDING`, or `siteId` is absent.

The dashboard stores the current token under `smartpass360.token` and sends it as a Bearer token on API calls. A successful building login returns a token signed using the API process's `AUTH_JWT_SECRET`. Therefore, a secret mismatch between API instances/restarts or a stale/invalid browser token can produce this symptom. A token for the OWNER scope also correctly fails these building-only routes.

The dashboard deployment's configured `VITE_API_BASE_URL` is build-time configuration. The production project currently lists it as `https://api.smartcycle360.com/api/v1`. Check the deployed asset/request URL if there is any doubt about which API hostname was compiled into the current client.

## Safe triage sequence

1. Open browser DevTools → Network. Select the failing `operations-summary` request and record (do not share the token itself): Request URL, status, response JSON, `x-request-id`, and whether the request has an `Authorization: Bearer` header.
2. Confirm the login request returned HTTP 200, with `data.user.scope === "BUILDING"` and a non-empty `data.user.siteId`. Never paste the returned token into an issue, screenshot, or chat.
3. If the browser session was logged in before an API restart/reconfiguration, sign out by clearing only the SmartPass360 session keys in DevTools Application → Local Storage (`smartpass360.token`, `smartpass360.user`), then sign in again. This obtains a freshly signed token. Do not clear unrelated application storage.
4. Compare the API process's effective `AUTH_JWT_SECRET` across all live API processes/containers. Compare securely on the server; do not print or paste the secret. All API replicas must use the same secret, and it must remain stable across restarts.
5. Use the response's `x-request-id` to find the corresponding API log entry. The API's Pino logger redacts Authorization headers. Do not enable token/header logging to debug this.
6. If a fresh BUILDING login still gets 403, check whether the logged-in account's database site ID is present and whether all requests are routed to the intended API deployment. Keep `requireBuilding` in place; do not turn off authorization or change the 403 to a success response as a workaround.

## Regression checks before shipping

- A valid, unexpired BUILDING token with a site ID can pass `requireBuilding`.
- Missing token, bad signature, expired token, OWNER token, and BUILDING token without a site ID are rejected.
- Login never sends an old browser token; authenticated non-login API requests send the newly saved token.
- Production build uses the intended API base URL.
- Run the repository's root `npm run typecheck` and `npm run build`, plus any auth middleware/API client tests.

## Current diagnostic limit

Repository code confirms the rejection conditions, but code inspection alone does not prove which condition triggered in production. The live API response body and request ID, effective API runtime configuration, and corresponding server log are required to identify the exact cause before changing auth logic.
