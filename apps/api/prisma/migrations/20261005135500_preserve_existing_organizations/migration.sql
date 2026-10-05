INSERT INTO "sites" (
  "id",
  "name",
  "code",
  "is_active",
  "created_at",
  "updated_at",
  "status",
  "must_change_password"
)
SELECT
  gen_random_uuid(),
  'Imported Building',
  'IMPORTED',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'PENDING',
  true
WHERE NOT EXISTS (SELECT 1 FROM "sites")
  AND EXISTS (SELECT 1 FROM "organizations");

INSERT INTO "site_organizations" (
  "id",
  "site_id",
  "organization_id",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  s."id",
  o."id",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "sites" s
CROSS JOIN "organizations" o
WHERE s."code" = 'IMPORTED'
  AND NOT EXISTS (
    SELECT 1
    FROM "site_organizations" so
    WHERE so."site_id" = s."id"
      AND so."organization_id" = o."id"
  );
