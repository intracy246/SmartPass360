# SmartPass360 Security Hardening Batch

Status: assessment and implementation plan; not a security certification.

## Confirmed from source review

- The dashboard stores bearer tokens in `localStorage` under `smartpass360.token`. JavaScript executing in the origin can read them. Migration to secure, HttpOnly, SameSite cookies requires coordinated API and dashboard work and CSRF protections; do not change only one side.
- CORS is allowlist-based and Helmet is enabled. Keep production origins exact; do not use wildcards with credentials.
- Authentication uses a custom HMAC token with a 12-hour expiry. Verify signature handling and expiry semantics with regression tests before any replacement.
- Dashboard API base URL is a public Vite build variable and is expected to be visible in browser bundles. It is configuration, not a secret. Do not put server-side API/database/signing keys in `VITE_*` variables.
- Keep actual secrets out of Git; use Vercel environment variables and root-owned environment files/systemd secrets on Ubuntu.

## Implemented in the security hardening batch

- URL-encoded payloads are limited to 100 KB and 1,000 parameters.
- Login and kiosk activation endpoints have in-process throttling and return HTTP 429 with Retry-After after repeated attempts. This does not replace upstream WAF/CDN throttling and is per API process.
- Production configuration requires a dedicated `PERMANENT_PASS_QR_ENCRYPTION_KEY`, different from `AUTH_JWT_SECRET`. New encrypted QR credentials use format `v2`; existing `v1` values remain decryptable with the legacy JWT secret during migration.
- Kiosk list/device/config responses are narrowed so the stored activation code is not repeatedly returned. Kiosk creation still returns its activation code once because the existing dashboard displays it for device provisioning.
- Gate-device list returns explicit non-secret fields; the stored device key hash is not returned.
- Public health response no longer discloses the runtime environment.
- The API's production-runtime smoke test now supplies a dedicated QR encryption key distinct from the JWT secret.

## Production rollout gates

1. Confirm the API is running the merged source with a valid `PERMANENT_PASS_QR_ENCRYPTION_KEY` that is high-entropy, at least 32 characters, and different from `AUTH_JWT_SECRET`.
2. Keep the existing JWT secret and legacy `v1` decryption path until stored `v1` QR ciphertexts have been safely re-encrypted or a tested migration path preserves their readability.
3. Run API build/typecheck and the production-runtime smoke test in an environment with database access. The smoke test checks the database readiness endpoint.
4. Verify owner login, kiosk activation/configuration, permanent-pass QR create/reprint/replace, site isolation, and throttling in a production-like environment.
5. Confirm backups and rollback steps before any API rollout that changes secret requirements.
6. Keep the dashboard bearer-token/localStorage design documented as residual risk. Moving to HttpOnly cookies requires coordinated CSRF, CORS, logout and session invalidation work.

## Validation notes

- The workspace build was reported successful locally for API, dashboard, and kiosk.
- The last local `npm audit` reported 0 vulnerabilities; an earlier audit run reported 21, before lockfile synchronization. Re-run audit against the merged lockfile as part of CI.
- Vercel reports production-target deployments for dashboard and kiosk in `READY` state for the merge commit. That confirms front-end deployment build completion, not that the external API service has the required secret or that end-to-end flows were tested.
- The current Vercel deployment history does not show a deployed API service project in the same Vercel team. The API is described by the dashboard environment variable as being served through a Cloudflare Tunnel; verify that API host and its Ubuntu/systemd environment separately.
- Vercel build logs warn that dependency install scripts for Prisma/esbuild are awaiting explicit approval. Review package scripts before approving them.
- Dashboard build still emits non-fatal warnings about ineffective dynamic imports and a JavaScript chunk larger than 500 kB.

This document is a rollout checklist, not a security certification. Do not rotate secrets on a live system until existing encrypted QR credentials remain decryptable. Never paste private keys, database URLs, JWT secrets, device keys, session tokens, or production `.env` contents into issues, chat, shell history, or repository files.
