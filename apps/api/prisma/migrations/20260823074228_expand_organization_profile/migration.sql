-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "organization_type" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "short_name" TEXT,
ADD COLUMN     "website" TEXT;
