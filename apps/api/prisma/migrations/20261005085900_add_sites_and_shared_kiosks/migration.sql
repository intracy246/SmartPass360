CREATE TABLE "sites" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "address" TEXT,
  "city" TEXT,
  "country" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_organizations" (
  "id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kiosks" (
  "id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "location" TEXT,
  "activation_code" TEXT NOT NULL,
  "device_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "activated_at" TIMESTAMP(3),
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kiosks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");
CREATE INDEX "sites_is_active_idx" ON "sites"("is_active");
CREATE UNIQUE INDEX "site_organizations_site_id_organization_id_key" ON "site_organizations"("site_id", "organization_id");
CREATE INDEX "site_organizations_organization_id_idx" ON "site_organizations"("organization_id");
CREATE UNIQUE INDEX "kiosks_code_key" ON "kiosks"("code");
CREATE UNIQUE INDEX "kiosks_activation_code_key" ON "kiosks"("activation_code");
CREATE UNIQUE INDEX "kiosks_device_id_key" ON "kiosks"("device_id");
CREATE INDEX "kiosks_site_id_idx" ON "kiosks"("site_id");
CREATE INDEX "kiosks_is_active_idx" ON "kiosks"("is_active");

ALTER TABLE "site_organizations" ADD CONSTRAINT "site_organizations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_organizations" ADD CONSTRAINT "site_organizations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
