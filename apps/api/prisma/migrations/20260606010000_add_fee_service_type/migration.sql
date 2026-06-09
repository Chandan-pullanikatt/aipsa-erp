-- CreateEnum
CREATE TYPE "FeeServiceType" AS ENUM ('NONE', 'TRANSPORT', 'HOSTEL');

-- AlterTable: mark a fee category as a service fee (transport/hostel) so the
-- defaulter report only bills students enrolled in that service.
ALTER TABLE "fee_categories" ADD COLUMN "serviceType" "FeeServiceType" NOT NULL DEFAULT 'NONE';
