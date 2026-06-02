-- AlterTable: add inchargeTeacherId to classes
ALTER TABLE "classes" ADD COLUMN "inchargeTeacherId" TEXT;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_inchargeTeacherId_fkey"
  FOREIGN KEY ("inchargeTeacherId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
