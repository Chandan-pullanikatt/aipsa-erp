-- Multiple teachers per subject, optionally scoped to a section.
-- subjects.teacherId is retained as the primary teacher.

CREATE TABLE "subject_teachers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "sectionId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_teachers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subject_teachers_subjectId_teacherId_sectionId_key"
    ON "subject_teachers"("subjectId", "teacherId", "sectionId");

-- Postgres treats NULLs as distinct in unique indexes, so the composite index
-- above will not stop a duplicate class-wide (sectionId IS NULL) assignment.
CREATE UNIQUE INDEX "subject_teachers_subject_teacher_classwide_key"
    ON "subject_teachers"("subjectId", "teacherId")
    WHERE "sectionId" IS NULL;

CREATE INDEX "subject_teachers_tenantId_teacherId_idx" ON "subject_teachers"("tenantId", "teacherId");
CREATE INDEX "subject_teachers_tenantId_subjectId_idx" ON "subject_teachers"("tenantId", "subjectId");
CREATE INDEX "subject_teachers_tenantId_sectionId_idx" ON "subject_teachers"("tenantId", "sectionId");

ALTER TABLE "subject_teachers" ADD CONSTRAINT "subject_teachers_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_teachers" ADD CONSTRAINT "subject_teachers_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_teachers" ADD CONSTRAINT "subject_teachers_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_teachers" ADD CONSTRAINT "subject_teachers_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing single assignment becomes a class-wide primary row.
INSERT INTO "subject_teachers" ("id", "tenantId", "subjectId", "teacherId", "sectionId", "isPrimary", "createdAt", "updatedAt")
SELECT
    'st_' || md5(s."id" || s."teacherId"),
    s."tenantId",
    s."id",
    s."teacherId",
    NULL,
    true,
    NOW(),
    NOW()
FROM "subjects" s
WHERE s."teacherId" IS NOT NULL;
