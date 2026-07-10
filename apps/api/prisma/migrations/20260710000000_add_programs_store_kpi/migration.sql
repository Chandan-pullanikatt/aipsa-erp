-- Programs & Registrations engine, Store online-checkout fields, and KPI & Reports.
-- Fully ADDITIVE: new enums + new tables + new nullable columns only. No existing
-- column is altered or dropped, so this is backward-compatible with running code.

-- ─── Enums ──────────────────────────────────────────────────────────────────────
CREATE TYPE "ProgramType" AS ENUM ('COMPETITION', 'TUITION', 'TRAINING', 'COUNSELING', 'EVENT');
CREATE TYPE "ProgramAudience" AS ENUM ('STUDENT', 'PARENT', 'TEACHER', 'PRINCIPAL', 'ANYONE');
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "RegPaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED');
CREATE TYPE "KpiInputType" AS ENUM ('TEXT', 'NUMBER', 'CURRENCY', 'STATUS');

-- ─── Store: online-checkout additions (additive columns) ───────────────────────
ALTER TABLE "store_items" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "store_items" ADD COLUMN "stock" INTEGER;

ALTER TABLE "purchases" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'PAID';
ALTER TABLE "purchases" ADD COLUMN "razorpayOrderId" TEXT;
ALTER TABLE "purchases" ADD COLUMN "razorpayPaymentId" TEXT;
CREATE UNIQUE INDEX "purchases_razorpayOrderId_key" ON "purchases"("razorpayOrderId");

-- ─── Programs ───────────────────────────────────────────────────────────────────
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "type" "ProgramType" NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "audience" "ProgramAudience" NOT NULL DEFAULT 'ANYONE',
    "capacity" INTEGER,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "requiresTeacherMatch" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "programs_tenantId_idx" ON "programs"("tenantId");
CREATE INDEX "programs_tenantId_type_idx" ON "programs"("tenantId", "type");
CREATE INDEX "programs_type_isActive_idx" ON "programs"("type", "isActive");

CREATE TABLE "program_items" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fee" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "program_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "program_items_programId_idx" ON "program_items"("programId");

CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "programItemId" TEXT,
    "registrantUserId" TEXT NOT NULL,
    "studentId" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "RegPaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "assignedTeacherId" TEXT,
    "formData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "registrations_razorpayOrderId_key" ON "registrations"("razorpayOrderId");
CREATE INDEX "registrations_tenantId_idx" ON "registrations"("tenantId");
CREATE INDEX "registrations_programId_idx" ON "registrations"("programId");
CREATE INDEX "registrations_tenantId_registrantUserId_idx" ON "registrations"("tenantId", "registrantUserId");
CREATE INDEX "registrations_assignedTeacherId_idx" ON "registrations"("assignedTeacherId");

-- ─── KPI & Reports ──────────────────────────────────────────────────────────────
CREATE TABLE "kpi_areas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kpi_areas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "kpi_areas_tenantId_idx" ON "kpi_areas"("tenantId");

CREATE TABLE "kpi_particulars" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputType" "KpiInputType" NOT NULL DEFAULT 'TEXT',
    "isKpi" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kpi_particulars_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "kpi_particulars_areaId_idx" ON "kpi_particulars"("areaId");

CREATE TABLE "daily_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "preparedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "daily_reports_tenantId_reportDate_key" ON "daily_reports"("tenantId", "reportDate");
CREATE INDEX "daily_reports_tenantId_idx" ON "daily_reports"("tenantId");

CREATE TABLE "daily_report_entries" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "particularId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNum" DOUBLE PRECISION,
    "remarks" TEXT,
    "followUp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_report_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "daily_report_entries_reportId_idx" ON "daily_report_entries"("reportId");
CREATE INDEX "daily_report_entries_particularId_idx" ON "daily_report_entries"("particularId");

-- ─── Foreign keys ───────────────────────────────────────────────────────────────
ALTER TABLE "programs" ADD CONSTRAINT "programs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_items" ADD CONSTRAINT "program_items_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registrations" ADD CONSTRAINT "registrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_programItemId_fkey" FOREIGN KEY ("programItemId") REFERENCES "program_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_registrantUserId_fkey" FOREIGN KEY ("registrantUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_assignedTeacherId_fkey" FOREIGN KEY ("assignedTeacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kpi_areas" ADD CONSTRAINT "kpi_areas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kpi_particulars" ADD CONSTRAINT "kpi_particulars_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "kpi_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "daily_report_entries" ADD CONSTRAINT "daily_report_entries_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_report_entries" ADD CONSTRAINT "daily_report_entries_particularId_fkey" FOREIGN KEY ("particularId") REFERENCES "kpi_particulars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
