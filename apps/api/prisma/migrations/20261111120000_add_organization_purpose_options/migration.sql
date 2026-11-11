CREATE TABLE "purpose_options" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purpose_options_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purpose_options_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "purpose_options_organization_id_name_key" ON "purpose_options"("organization_id", "name");
CREATE INDEX "purpose_options_organization_id_is_active_idx" ON "purpose_options"("organization_id", "is_active");
