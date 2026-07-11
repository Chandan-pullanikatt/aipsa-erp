-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('DISCIPLINARY', 'ACHIEVEMENT', 'REMARK');

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "joinCode" TEXT;

-- AlterTable
ALTER TABLE "fee_structures" ADD COLUMN     "dueDate" DATE;

-- AlterTable
ALTER TABLE "lms_materials" ADD COLUMN     "isFreePreview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "school_profiles" ADD COLUMN     "lateFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lateFeeGraceDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "premiumLmsPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "feeAccessOverride" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "premium_lms_subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "premium_lms_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "late_fee_waivers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "waivedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "late_fee_waivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_join_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "parentPhone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_activities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "premium_lms_subscriptions_razorpayOrderId_key" ON "premium_lms_subscriptions"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "premium_lms_subscriptions_tenantId_studentId_idx" ON "premium_lms_subscriptions"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "premium_lms_subscriptions_tenantId_studentId_academicYear_key" ON "premium_lms_subscriptions"("tenantId", "studentId", "academicYear");

-- CreateIndex
CREATE INDEX "late_fee_waivers_tenantId_studentId_idx" ON "late_fee_waivers"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "late_fee_waivers_tenantId_studentId_feeStructureId_academic_key" ON "late_fee_waivers"("tenantId", "studentId", "feeStructureId", "academicYear");

-- CreateIndex
CREATE INDEX "class_join_requests_tenantId_idx" ON "class_join_requests"("tenantId");

-- CreateIndex
CREATE INDEX "class_join_requests_tenantId_classId_status_idx" ON "class_join_requests"("tenantId", "classId", "status");

-- CreateIndex
CREATE INDEX "student_activities_tenantId_studentId_idx" ON "student_activities"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "classes_joinCode_key" ON "classes"("joinCode");

-- AddForeignKey
ALTER TABLE "premium_lms_subscriptions" ADD CONSTRAINT "premium_lms_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "premium_lms_subscriptions" ADD CONSTRAINT "premium_lms_subscriptions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_fee_waivers" ADD CONSTRAINT "late_fee_waivers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_fee_waivers" ADD CONSTRAINT "late_fee_waivers_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_fee_waivers" ADD CONSTRAINT "late_fee_waivers_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_fee_waivers" ADD CONSTRAINT "late_fee_waivers_waivedById_fkey" FOREIGN KEY ("waivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_join_requests" ADD CONSTRAINT "class_join_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_join_requests" ADD CONSTRAINT "class_join_requests_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_join_requests" ADD CONSTRAINT "class_join_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_activities" ADD CONSTRAINT "student_activities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_activities" ADD CONSTRAINT "student_activities_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_activities" ADD CONSTRAINT "student_activities_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

