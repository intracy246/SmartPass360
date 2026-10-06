CREATE TYPE "VehicleAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');
CREATE TYPE "VehicleAccessDecision" AS ENUM ('AUTHORIZED', 'UNKNOWN', 'APPROVED', 'DENIED');
CREATE TYPE "VehicleGateAction" AS ENUM ('UNLOCK', 'KEEP_LOCKED');

CREATE TABLE "authorized_vehicles" (
  "id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "permanent_pass_id" UUID NOT NULL,
  "plate_number" TEXT NOT NULL,
  "normalized_plate_number" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_currently_inside" BOOLEAN NOT NULL DEFAULT false,
  "last_entry_at" TIMESTAMP(3),
  "last_exit_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "authorized_vehicles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gate_access_devices" (
  "id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "gate_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "device_key_hash" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gate_access_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_access_requests" (
  "id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "gate_id" UUID NOT NULL,
  "plate_number" TEXT NOT NULL,
  "normalized_plate_number" TEXT NOT NULL,
  "direction" "AccessDirection" NOT NULL,
  "confidence" DOUBLE PRECISION,
  "snapshot_url" TEXT,
  "status" "VehicleAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicle_access_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_access_events" (
  "id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "organization_id" UUID,
  "authorized_vehicle_id" UUID,
  "permanent_pass_id" UUID,
  "gate_id" UUID NOT NULL,
  "vehicle_access_request_id" UUID,
  "device_request_id" TEXT,
  "plate_number" TEXT NOT NULL,
  "normalized_plate_number" TEXT NOT NULL,
  "direction" "AccessDirection" NOT NULL,
  "decision" "VehicleAccessDecision" NOT NULL,
  "action" "VehicleGateAction" NOT NULL,
  "confidence" DOUBLE PRECISION,
  "reason" TEXT NOT NULL,
  "approved_by" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "vehicle_access_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "authorized_vehicles_site_id_normalized_plate_number_key" ON "authorized_vehicles"("site_id", "normalized_plate_number");
CREATE INDEX "authorized_vehicles_permanent_pass_id_idx" ON "authorized_vehicles"("permanent_pass_id");
CREATE INDEX "authorized_vehicles_site_id_is_active_idx" ON "authorized_vehicles"("site_id", "is_active");
CREATE UNIQUE INDEX "gate_access_devices_device_key_hash_key" ON "gate_access_devices"("device_key_hash");
CREATE UNIQUE INDEX "gate_access_devices_site_id_gate_id_name_key" ON "gate_access_devices"("site_id", "gate_id", "name");
CREATE INDEX "gate_access_devices_gate_id_is_active_idx" ON "gate_access_devices"("gate_id", "is_active");
CREATE INDEX "vehicle_access_requests_site_id_status_detected_at_idx" ON "vehicle_access_requests"("site_id", "status", "detected_at");
CREATE INDEX "vehicle_access_requests_gate_id_detected_at_idx" ON "vehicle_access_requests"("gate_id", "detected_at");
CREATE INDEX "vehicle_access_requests_site_id_normalized_plate_number_idx" ON "vehicle_access_requests"("site_id", "normalized_plate_number");
CREATE UNIQUE INDEX "vehicle_access_events_site_id_device_request_id_key" ON "vehicle_access_events"("site_id", "device_request_id");
CREATE INDEX "vehicle_access_events_site_id_occurred_at_idx" ON "vehicle_access_events"("site_id", "occurred_at");
CREATE INDEX "vehicle_access_events_authorized_vehicle_id_occurred_at_idx" ON "vehicle_access_events"("authorized_vehicle_id", "occurred_at");
CREATE INDEX "vehicle_access_events_permanent_pass_id_idx" ON "vehicle_access_events"("permanent_pass_id");
CREATE INDEX "vehicle_access_events_gate_id_occurred_at_idx" ON "vehicle_access_events"("gate_id", "occurred_at");
CREATE INDEX "vehicle_access_events_vehicle_access_request_id_idx" ON "vehicle_access_events"("vehicle_access_request_id");
CREATE INDEX "vehicle_access_events_site_id_normalized_plate_number_occurred_at_idx" ON "vehicle_access_events"("site_id", "normalized_plate_number", "occurred_at");

ALTER TABLE "authorized_vehicles" ADD CONSTRAINT "authorized_vehicles_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authorized_vehicles" ADD CONSTRAINT "authorized_vehicles_permanent_pass_id_fkey" FOREIGN KEY ("permanent_pass_id") REFERENCES "permanent_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_access_devices" ADD CONSTRAINT "gate_access_devices_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_access_devices" ADD CONSTRAINT "gate_access_devices_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_access_requests" ADD CONSTRAINT "vehicle_access_requests_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_access_requests" ADD CONSTRAINT "vehicle_access_requests_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_access_events" ADD CONSTRAINT "vehicle_access_events_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_access_events" ADD CONSTRAINT "vehicle_access_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicle_access_events" ADD CONSTRAINT "vehicle_access_events_authorized_vehicle_id_fkey" FOREIGN KEY ("authorized_vehicle_id") REFERENCES "authorized_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicle_access_events" ADD CONSTRAINT "vehicle_access_events_permanent_pass_id_fkey" FOREIGN KEY ("permanent_pass_id") REFERENCES "permanent_passes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicle_access_events" ADD CONSTRAINT "vehicle_access_events_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_access_events" ADD CONSTRAINT "vehicle_access_events_vehicle_access_request_id_fkey" FOREIGN KEY ("vehicle_access_request_id") REFERENCES "vehicle_access_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
