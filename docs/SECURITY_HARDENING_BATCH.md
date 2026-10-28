# SmartPass360 Security Hardening Batch

Status: assessment and implementation plan; not a security certification.

## Confirmed from source review

- The dashboard stores bearer tokens in `localStorage` under `smartpass360.token`. JavaScript executing in the origin can read them. Migration to secure, HttpOnly, SameSite cookies requires coordinated API and dashboard work and CSRF protections; do not change only one side.
- Login currently has no visible application-level rate limit. Confirm proxy/CDN limits and add API-side controls with trusted-proxy configuration reviewed first.
- `AUTH_JWT_SECRET` is currently used as a fallback when `PERMANENT_PASS_QR_ENCRYPTION_KEY` is unset. Separate keys should be required for production, with a planned QR re-encryption/rotation migration before changing keys for existing encrypted credentials.
- A number of Prisma calls use broad `include: { site: true }`/raw records. The response shapes must be reviewed field-by-field and narrowed to explicit selects, especially kiosk and gate-device data.
- CORS is allowlist-based and Helmet is enabled. Keep production origins exact; do not use wildcards with credentials.
- `express.json` has a 1 MB limit, but `express.urlencoded({ extended: true })` currently has no explicit size limit.
- Authentication uses a custom HMAC token with a 12-hour expiry. Verify signature handling and expiry semantics with regression tests before any replacement.
- Environment validation rejects the known default JWT secret/owner credentials in production. Keep all actual secrets out of Git; use Vercel environment variables and root-owned environment files/systemd secrets on Ubuntu.
- Dashboard API base URL is a public Vite build variable and is expected to be visible in browser bundles. It is configuration, not a secret. Do not put server-side API/database/signing keys in `VITE_*` variables.

## Required implementation/test sequence

1. Inventory all environment names and scan Git history/current tracked files for leaked credentials. If any real credential was committed, revoke/rotate it at its issuing service; removing it from the latest commit alone is insufficient.
2. Audit and explicitly serialize every route response. Never return password hashes, device-key hashes, credentials, or unrestricted related rows. Keep one-time device-key disclosure only where the product contract deliberately issues a new key.
3. Add API-side rate limiting and anti-brute-force controls for login and sensitive credential endpoints. Configure reverse-proxy trust only for the actual known proxy chain; test IPv4/IPv6 and avoid spoofable forwarded IPs.
4. Tighten request-body limits (including URL-encoded forms), input validation, security headers, cache policy for private data, and consistent non-sensitive error responses.
5. Add authentication/authorization tests: missing/expired/tampered token, wrong scope, no siteId, cross-building IDOR, inactive/suspended building, inactive device, and repeated hardware acknowledgement. Preserve existing authorization and access-control business rules.
6. Move bearer-session storage from localStorage only as part of a coordinated design: Secure + HttpOnly + SameSite cookie, CSRF defense, CORS/credentials alignment, logout/invalidation, and tests. Avoid a partial deployment that breaks existing login.
7. Give QR encryption its own high-entropy production secret. Plan key-version support and re-encryption of currently stored encrypted QR data before switching the key.
8. Add dependency audit and CI checks: build/typecheck, smoke tests, secret scanning, dependency alerts, and least-privilege workflow permissions.
9. Ubuntu hardening: non-root systemd service, root-owned 0600 environment file, firewall exposing only required ports, API reachable only through intended reverse proxy/tunnel, database not publicly exposed, SSH keys and disabled password/root login where operationally safe, patching, backups, and restore test.
10. Production release checklist: review diff, local build/typecheck/smoke tests, preview API/dashboard login and building isolation, backup, documented rollback, then deploy in a maintenance-aware window.

## Safe operating rules

- This plan does not claim that a vulnerability has been fixed until a corresponding code change and regression test exist.
- Do not rotate secrets on a live system without ensuring all API instances share the correct replacement values and QR data remains decryptable.
- Never paste private keys, database URLs, JWT secrets, device keys, session tokens, or production `.env` contents into issues, chat, shell history, or repository files.
- Do not deploy a security branch directly to production before tests and the rollback procedure pass.


## Implemented in this security branch (not yet production-approved)

- URL-encoded payloads are limited to 100 KB and 1,000 parameters.
- Login and kiosk activation endpoints have in-process throttling and return HTTP 429 with Retry-After after repeated attempts. This does not replace upstream WAF/CDN throttling and is per API process.
- Production configuration requires a dedicated `PERMANENT_PASS_QR_ENCRYPTION_KEY`, different from `AUTH_JWT_SECRET`. New encrypted QR credentials use format `v2`; existing `v1` credentials are still decryptable with the legacy JWT secret during migration. Keep the old JWT secret available until stored v1 credentials have been re-encrypted, then retire the legacy decryption path in a separate change.
- Kiosk list and device/config responses are narrowed so the stored activation code is not repeatedly returned. Kiosk creation still returns its activation code once because the existing dashboard displays it for device provisioning.
- Gate-device list returns explicit non-secret fields; the stored device key hash is not returned.
- Public health response no longer discloses the runtime environment.
- `apps/api/.env.example` explains the separate QR encryption key setting.

## Validation state

These changes were committed to an isolated branch. The connected workflow has not run the project build, typecheck, or smoke/integration suite. Do not merge or deploy until the local and production-like checks pass. The branch has not changed database schema or access-policy business rules.
