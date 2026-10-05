CREATE TYPE "SiteStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

ALTER TABLE "sites"
ADD COLUMN "admin_username" TEXT,
ADD COLUMN "admin_password_hash" TEXT,
ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "status" "SiteStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "provisioned_at" TIMESTAMP(3),
ADD COLUMN "activated_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "sites_admin_username_key" ON "sites"("admin_username");
CREATE INDEX "sites_status_idx" ON "sites"("status");
