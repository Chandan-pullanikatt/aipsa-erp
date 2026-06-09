-- CreateEnum
CREATE TYPE "BoardingType" AS ENUM ('DAY_SCHOLAR', 'HOSTELER');

-- AlterTable: student photo + boarding/transport foundation fields
ALTER TABLE "students" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "students" ADD COLUMN "boardingType" "BoardingType" NOT NULL DEFAULT 'DAY_SCHOLAR';
ALTER TABLE "students" ADD COLUMN "needsBus" BOOLEAN NOT NULL DEFAULT false;
