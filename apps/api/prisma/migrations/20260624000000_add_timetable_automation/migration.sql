-- AlterTable: weekly period load per subject (drives auto-generation)
ALTER TABLE "subjects" ADD COLUMN "periodsPerWeek" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: per-school bell schedule / grid template
CREATE TABLE "timetable_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "workingDays" JSONB NOT NULL,
    "slots" JSONB NOT NULL,
    "maxPeriodsPerDayPerTeacher" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: teacher unavailability (blocked slots)
CREATE TABLE "teacher_availability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "periodNumber" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timetable_configs_tenantId_idx" ON "timetable_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_configs_tenantId_academicYear_key" ON "timetable_configs"("tenantId", "academicYear");

-- CreateIndex
CREATE INDEX "teacher_availability_tenantId_teacherId_idx" ON "teacher_availability"("tenantId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_avail_unique" ON "teacher_availability"("tenantId", "teacherId", "academicYear", "dayOfWeek", "periodNumber");

-- AddForeignKey
ALTER TABLE "timetable_configs" ADD CONSTRAINT "timetable_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
