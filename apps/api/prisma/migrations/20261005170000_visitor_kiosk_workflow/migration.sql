-- Add explicit tenancy/provenance without guessing the building of legacy visits.
ALTER TABLE "visit_requests"
  ADD COLUMN "site_id" UUID,
  ADD COLUMN "kiosk_id" UUID,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "kiosk_receipt_hash" TEXT;
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_kiosk_id_fkey"
  FOREIGN KEY ("kiosk_id") REFERENCES "kiosks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "visit_requests_site_id_status_idx" ON "visit_requests"("site_id", "status");
CREATE INDEX "visit_requests_kiosk_id_idx" ON "visit_requests"("kiosk_id");

-- Unknown/invalid credentials still need a real, tenant-scoped denial audit.
-- Existing references and rows are retained; only absent identities become nullable.
ALTER TABLE "access_events"
  ADD COLUMN "site_id" UUID,
  ADD COLUMN "request_id" UUID,
  ALTER COLUMN "organization_id" DROP NOT NULL,
  ALTER COLUMN "visit_id" DROP NOT NULL,
  ALTER COLUMN "visitor_pass_id" DROP NOT NULL,
  ALTER COLUMN "gate_id" DROP NOT NULL;
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "access_events_site_id_scanned_at_idx" ON "access_events"("site_id", "scanned_at");
CREATE UNIQUE INDEX "access_events_site_id_request_id_key" ON "access_events"("site_id", "request_id");
