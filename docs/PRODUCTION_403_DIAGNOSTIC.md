# SmartPass360 production 403 diagnostic runbook

## Confirmed production symptom

The Owner Dashboard at `https://smartpass.smartcycle360.com/owner` calls:

- `GET /api/v1/auth/buildings`

The browser response captured on 2026-10-28 was HTTP `403 Forbidden` with:

```json
{"error":{"code":"FORBIDDEN","message":"Owner access required."}}
```

Source code confirms this response is produced by `requireOwner` in `apps/api/src/middleware/auth.middleware.ts` when the API cannot read a valid signed user from the request or the token's `scope` is not `OWNER`. The endpoint is mounted from `ownerRouter` at `/api/v1/auth`, and `GET /buildings` specifically uses `requireOwner`.

This differs from the `Building access required.` response produced by `requireBuilding` on Building-dashboard APIs. Do not treat the current Owner Dashboard 403 as a Building-scope issue.

## Safe triage sequence for the Owner Dashboard

1. In Chrome DevTools → Network, select the failed `buildings` request and confirm its Request URL is the expected production host. Under Request Headers, check whether `Authorization: Bearer …` is present. Never copy or share the token itself.
2. In the same Network panel, select the `/auth/login` request. Confirm it returns HTTP 200 and the response user's `scope` is `OWNER`. Do not share the response token or login credentials.
3. If the browser might have an older session, clear only `smartpass360.token` and `smartpass360.user` from DevTools → Application → Local Storage for the SmartPass360 site, then sign in again with the issued Owner credentials and retry the buildings request.
4. If a fresh Owner login succeeds but `GET /auth/buildings` still returns this 403, compare the effective `AUTH_JWT_SECRET` configuration of all live API instances securely on the server. Do not print or share the secret. All replicas must use the same secret and keep it stable across restarts.
5. Record the failed request's `x-request-id` response header (if present) and locate that ID in the API logs. The Pino logger is configured to redact Authorization and Cookie headers. Do not enable token/header logging as a workaround.
6. If login fails or the returned scope is not `OWNER`, inspect the Owner credentials and production API configuration. Do not bypass the middleware or change a 403 into success.

## Related Building-dashboard endpoints

The Building dashboard APIs `/api/v1/access/operations-summary` and `/api/v1/vehicle-access/requests` use `requireBuilding`. These endpoints return `403 FORBIDDEN / Building access required.` when the signed token is missing/invalid/expired, the scope is not `BUILDING`, or `siteId` is missing. Diagnose these separately from the confirmed Owner Dashboard response above.

## Production configuration

The dashboard's `VITE_API_BASE_URL` is build-time configuration. The production dashboard project has been configured with `https://api.smartcycle360.com/api/v1`. Confirm the deployed Request URL matches the intended host, especially if deployment settings changed.

The API signs session tokens using `AUTH_JWT_SECRET`. All live API replicas must use the same secret. Never log or paste the secret or bearer tokens.

## Regression checks before shipping

- Owner login returns a signed token whose user scope is `OWNER`.
- A valid, unexpired Owner token can access `GET /api/v1/auth/buildings`.
- Missing/invalid/expired tokens and non-Owner tokens are rejected by `requireOwner`.
- A valid Building token with a site ID can pass `requireBuilding`; invalid scope, missing site ID, and invalid/expired tokens are rejected.
- Login requests do not forward stale browser Authorization tokens; authenticated API requests send the current token.
- Run dashboard/API typecheck and builds plus relevant authentication tests before release.

## Current diagnostic limit

The production response now confirms the Owner authorization middleware is rejecting the buildings request. The screenshot alone cannot distinguish a missing/invalid signature from a valid token whose scope is not `OWNER`. The login request result, presence of Authorization header, and corresponding API logs (using `x-request-id`) are needed to identify which condition is happening. Keep access control enabled while diagnosing.
