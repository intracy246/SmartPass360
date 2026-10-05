ALTER TABLE "visit_requests"
ADD COLUMN "destination_office" TEXT,
ADD COLUMN "host_name_snapshot" TEXT,
ALTER COLUMN "purpose" SET DEFAULT '';
