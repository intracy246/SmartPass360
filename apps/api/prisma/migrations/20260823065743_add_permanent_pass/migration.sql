-- CreateEnum
CREATE TYPE "VisitorType" AS ENUM ('WALK_IN', 'EXPECTED', 'CONTRACTOR', 'SUPPLIER', 'DELIVERY', 'INTERVIEW_CANDIDATE', 'GOVERNMENT_OFFICIAL', 'VIP');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PASS_ISSUED', 'READY_FOR_ENTRY', 'INSIDE', 'CHECKED_OUT', 'EXPIRED', 'CANCELLED', 'REVOKED', 'DENIED');

-- CreateEnum
CREATE TYPE "PassStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GateDirection" AS ENUM ('ENTRY', 'EXIT', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "GateStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AccessDirection" AS ENUM ('ENTRY', 'EXIT');

-- CreateEnum
CREATE TYPE "AccessDecision" AS ENUM ('GRANTED', 'DENIED', 'ERROR');

-- CreateEnum
CREATE TYPE "PermanentPassHolderType" AS ENUM ('EMPLOYEE', 'SECURITY', 'CLEANER', 'CONTRACTOR', 'TENANT', 'VENDOR', 'OTHER');

-- CreateEnum
CREATE TYPE "PermanentPassStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PermanentPassExpiryType" AS ENUM ('LIFETIME', 'FIXED_DATE');

-- CreateEnum
CREATE TYPE "PermanentPassActivityType" AS ENUM ('ENTRY', 'EXIT');

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hosts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "department_id" UUID,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "job_title" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitors" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "id_type" TEXT,
    "id_number_encrypted" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "company" TEXT,
    "photo_url" TEXT,
    "vehicle_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "visitor_id" UUID NOT NULL,
    "host_id" UUID,
    "department_id" UUID,
    "visitor_type" "VisitorType" NOT NULL DEFAULT 'WALK_IN',
    "purpose" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3),
    "expected_entry_time" TIMESTAMP(3),
    "expected_exit_time" TIMESTAMP(3),
    "approval_required" BOOLEAN NOT NULL DEFAULT false,
    "status" "VisitStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_at" TIMESTAMP(3),
    "checked_in_at" TIMESTAMP(3),
    "checked_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_passes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "visit_id" UUID NOT NULL,
    "pass_number" TEXT NOT NULL,
    "qr_token_hash" TEXT NOT NULL,
    "status" "PassStatus" NOT NULL DEFAULT 'ACTIVE',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "printed_at" TIMESTAMP(3),
    "print_count" INTEGER NOT NULL DEFAULT 0,
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "direction" "GateDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
    "status" "GateStatus" NOT NULL DEFAULT 'ONLINE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "visit_id" UUID NOT NULL,
    "visitor_pass_id" UUID NOT NULL,
    "gate_id" UUID NOT NULL,
    "direction" "AccessDirection" NOT NULL,
    "decision" "AccessDecision" NOT NULL,
    "denial_reason" TEXT,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "turnstile_opened" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permanent_passes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "pass_number" TEXT NOT NULL,
    "qr_token_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "staff_number" TEXT,
    "department" TEXT NOT NULL,
    "position" TEXT,
    "holder_type" "PermanentPassHolderType" NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "photo_url" TEXT,
    "status" "PermanentPassStatus" NOT NULL DEFAULT 'ACTIVE',
    "valid_from" TIMESTAMP(3) NOT NULL,
    "expiry_type" "PermanentPassExpiryType" NOT NULL,
    "expires_at" TIMESTAMP(3),
    "is_currently_inside" BOOLEAN NOT NULL DEFAULT false,
    "last_activity_type" "PermanentPassActivityType",
    "last_activity_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permanent_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permanent_pass_access_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "permanent_pass_id" UUID NOT NULL,
    "gate_id" UUID,
    "activity_type" "PermanentPassActivityType" NOT NULL,
    "decision" "AccessDecision" NOT NULL,
    "denial_reason" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "turnstile_opened" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permanent_pass_access_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_organization_id_idx" ON "departments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_code_key" ON "departments"("organization_id", "code");

-- CreateIndex
CREATE INDEX "hosts_organization_id_idx" ON "hosts"("organization_id");

-- CreateIndex
CREATE INDEX "hosts_department_id_idx" ON "hosts"("department_id");

-- CreateIndex
CREATE INDEX "hosts_full_name_idx" ON "hosts"("full_name");

-- CreateIndex
CREATE INDEX "visitors_organization_id_idx" ON "visitors"("organization_id");

-- CreateIndex
CREATE INDEX "visitors_full_name_idx" ON "visitors"("full_name");

-- CreateIndex
CREATE INDEX "visitors_phone_idx" ON "visitors"("phone");

-- CreateIndex
CREATE INDEX "visit_requests_organization_id_idx" ON "visit_requests"("organization_id");

-- CreateIndex
CREATE INDEX "visit_requests_visitor_id_idx" ON "visit_requests"("visitor_id");

-- CreateIndex
CREATE INDEX "visit_requests_host_id_idx" ON "visit_requests"("host_id");

-- CreateIndex
CREATE INDEX "visit_requests_department_id_idx" ON "visit_requests"("department_id");

-- CreateIndex
CREATE INDEX "visit_requests_status_idx" ON "visit_requests"("status");

-- CreateIndex
CREATE INDEX "visit_requests_created_at_idx" ON "visit_requests"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_passes_visit_id_key" ON "visitor_passes"("visit_id");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_passes_pass_number_key" ON "visitor_passes"("pass_number");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_passes_qr_token_hash_key" ON "visitor_passes"("qr_token_hash");

-- CreateIndex
CREATE INDEX "visitor_passes_organization_id_idx" ON "visitor_passes"("organization_id");

-- CreateIndex
CREATE INDEX "visitor_passes_status_idx" ON "visitor_passes"("status");

-- CreateIndex
CREATE INDEX "visitor_passes_valid_until_idx" ON "visitor_passes"("valid_until");

-- CreateIndex
CREATE INDEX "gates_organization_id_idx" ON "gates"("organization_id");

-- CreateIndex
CREATE INDEX "gates_status_idx" ON "gates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "gates_organization_id_code_key" ON "gates"("organization_id", "code");

-- CreateIndex
CREATE INDEX "access_events_organization_id_idx" ON "access_events"("organization_id");

-- CreateIndex
CREATE INDEX "access_events_visit_id_idx" ON "access_events"("visit_id");

-- CreateIndex
CREATE INDEX "access_events_visitor_pass_id_idx" ON "access_events"("visitor_pass_id");

-- CreateIndex
CREATE INDEX "access_events_gate_id_idx" ON "access_events"("gate_id");

-- CreateIndex
CREATE INDEX "access_events_decision_idx" ON "access_events"("decision");

-- CreateIndex
CREATE INDEX "access_events_scanned_at_idx" ON "access_events"("scanned_at");

-- CreateIndex
CREATE UNIQUE INDEX "permanent_passes_pass_number_key" ON "permanent_passes"("pass_number");

-- CreateIndex
CREATE UNIQUE INDEX "permanent_passes_qr_token_hash_key" ON "permanent_passes"("qr_token_hash");

-- CreateIndex
CREATE INDEX "permanent_passes_organization_id_idx" ON "permanent_passes"("organization_id");

-- CreateIndex
CREATE INDEX "permanent_passes_status_idx" ON "permanent_passes"("status");

-- CreateIndex
CREATE INDEX "permanent_passes_holder_type_idx" ON "permanent_passes"("holder_type");

-- CreateIndex
CREATE INDEX "permanent_passes_full_name_idx" ON "permanent_passes"("full_name");

-- CreateIndex
CREATE INDEX "permanent_passes_staff_number_idx" ON "permanent_passes"("staff_number");

-- CreateIndex
CREATE INDEX "permanent_passes_expires_at_idx" ON "permanent_passes"("expires_at");

-- CreateIndex
CREATE INDEX "permanent_pass_access_events_organization_id_idx" ON "permanent_pass_access_events"("organization_id");

-- CreateIndex
CREATE INDEX "permanent_pass_access_events_permanent_pass_id_idx" ON "permanent_pass_access_events"("permanent_pass_id");

-- CreateIndex
CREATE INDEX "permanent_pass_access_events_gate_id_idx" ON "permanent_pass_access_events"("gate_id");

-- CreateIndex
CREATE INDEX "permanent_pass_access_events_decision_idx" ON "permanent_pass_access_events"("decision");

-- CreateIndex
CREATE INDEX "permanent_pass_access_events_occurred_at_idx" ON "permanent_pass_access_events"("occurred_at");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosts" ADD CONSTRAINT "hosts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosts" ADD CONSTRAINT "hosts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "hosts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_passes" ADD CONSTRAINT "visitor_passes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_passes" ADD CONSTRAINT "visitor_passes_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visit_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visit_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_visitor_pass_id_fkey" FOREIGN KEY ("visitor_pass_id") REFERENCES "visitor_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permanent_passes" ADD CONSTRAINT "permanent_passes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permanent_pass_access_events" ADD CONSTRAINT "permanent_pass_access_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permanent_pass_access_events" ADD CONSTRAINT "permanent_pass_access_events_permanent_pass_id_fkey" FOREIGN KEY ("permanent_pass_id") REFERENCES "permanent_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
