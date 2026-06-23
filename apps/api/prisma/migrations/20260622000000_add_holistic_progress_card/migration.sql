-- CreateEnum
CREATE TYPE "ExamTerm" AS ENUM ('TERM_1', 'TERM_2', 'ANNUAL');

-- AlterTable: tag the report-card-eligible main exam of each term
ALTER TABLE "exams" ADD COLUMN "term" "ExamTerm";

-- CreateTable
CREATE TABLE "cca_areas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cca_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cca_grades" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ccaAreaId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "term" "ExamTerm" NOT NULL,
    "grade" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cca_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_terms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "term" "ExamTerm" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "conduct" JSONB,
    "achievements" TEXT,
    "remark" TEXT,
    "facultySnapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cca_areas_tenantId_classId_idx" ON "cca_areas"("tenantId", "classId");

-- CreateIndex
CREATE INDEX "cca_areas_tenantId_teacherId_idx" ON "cca_areas"("tenantId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "cca_areas_tenantId_classId_name_key" ON "cca_areas"("tenantId", "classId", "name");

-- CreateIndex
CREATE INDEX "cca_grades_tenantId_studentId_idx" ON "cca_grades"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "cca_grades_ccaAreaId_studentId_term_key" ON "cca_grades"("ccaAreaId", "studentId", "term");

-- CreateIndex
CREATE INDEX "progress_terms_tenantId_studentId_idx" ON "progress_terms"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "progress_terms_studentId_term_academicYear_key" ON "progress_terms"("studentId", "term", "academicYear");

-- AddForeignKey
ALTER TABLE "cca_areas" ADD CONSTRAINT "cca_areas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cca_areas" ADD CONSTRAINT "cca_areas_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cca_areas" ADD CONSTRAINT "cca_areas_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cca_grades" ADD CONSTRAINT "cca_grades_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cca_grades" ADD CONSTRAINT "cca_grades_ccaAreaId_fkey" FOREIGN KEY ("ccaAreaId") REFERENCES "cca_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cca_grades" ADD CONSTRAINT "cca_grades_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_terms" ADD CONSTRAINT "progress_terms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_terms" ADD CONSTRAINT "progress_terms_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_terms" ADD CONSTRAINT "progress_terms_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
