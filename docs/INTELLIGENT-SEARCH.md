# SmartPass360 Intelligent Search

## Scope

The dashboard-wide search launcher opens the dedicated `/search` page. The query is handled by the authenticated API endpoint:

`GET /api/v1/visitors/search?q=<term>`

The endpoint is available to the signed-in Building Dashboard only. It derives the tenant from the authenticated building session; callers cannot supply a site/building ID to widen the search.

## Indexed searchable fields

Visitor visit records:
- Visitor full name, phone, email and company.
- Exact visitor identification number match.
- Vehicle registration, destination department/office, host name and visit purpose.
- Organization name and code.
- Issued visitor pass number.

Permanent-pass holders:
- Full name, staff number, department, position, phone, email and pass number.
- Organization name and code.
- Active authorized-vehicle registration.

Identification number matching is exact and the identifier is not included in the response payload. The current visitor model column is named `idNumberEncrypted`; this endpoint does not attempt to decrypt or return it.

## Result behavior

- Queries shorter than two characters are rejected.
- At most 50 visitor visit records and 50 permanent-pass records are retrieved, with a combined response capped at 100 records.
- Results are sorted by record creation time, newest first.
- No matches returns an empty data array.
- Responses set `Cache-Control: no-store`.
- Search is read-only. It does not create, update, approve, revoke, or delete passes or visitor records.
- No schema migration is required.

## Mobile access

Both Building/Security and Platform Owner sidebars expose a Sign out button at mobile and tablet breakpoints where the desktop footer action is hidden. The action clears the existing session and navigates to the login page.
