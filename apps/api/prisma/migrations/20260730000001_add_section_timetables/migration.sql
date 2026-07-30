-- Section-level timetables and class teacher.
--
-- periods.sectionId null = timetable applies to the whole class (a class with
-- no sections). Once a class has sections, its per-section rows become the
-- authoritative timetable for that class.
--
-- sections.inchargeTeacherId is the section-level class teacher. classes.inchargeTeacherId
-- is retained as the fallback for classes that have no sections.

-- ─── Section incharge (class teacher) ────────────────────────────────────────

ALTER TABLE "sections" ADD COLUMN "inchargeTeacherId" TEXT;

ALTER TABLE "sections" ADD CONSTRAINT "sections_inchargeTeacherId_fkey"
    FOREIGN KEY ("inchargeTeacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Period.sectionId ─────────────────────────────────────────────────────────

ALTER TABLE "periods" ADD COLUMN "sectionId" TEXT;

ALTER TABLE "periods" ADD CONSTRAINT "periods_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Old constraint had no sectionId column; must go before the backfill below can
-- insert per-section rows that share (tenantId, classId, academicYear, dayOfWeek, periodNumber).
DROP INDEX "periods_tenantId_classId_academicYear_dayOfWeek_periodNumbe_key";

-- ─── Backfill: current academic year only ────────────────────────────────────
-- Copies each grade's existing (class-wide) timetable down to every section of
-- that grade, then retires the class-wide rows now that sections own them.
-- Other academic years are left as class-wide (sectionId null) rows.

DO $$
DECLARE
  v_year TEXT;
BEGIN
  v_year := CASE WHEN EXTRACT(MONTH FROM NOW()) >= 4
    THEN EXTRACT(YEAR FROM NOW())::text || '-' || RIGHT((EXTRACT(YEAR FROM NOW())::int + 1)::text, 2)
    ELSE (EXTRACT(YEAR FROM NOW())::int - 1)::text || '-' || RIGHT(EXTRACT(YEAR FROM NOW())::text, 2)
  END;

  INSERT INTO "periods" (
    "id", "tenantId", "classId", "sectionId", "academicYear", "dayOfWeek", "periodNumber",
    "startTime", "endTime", "subjectId", "teacherId", "isBreak", "breakLabel", "createdAt", "updatedAt"
  )
  SELECT
    'per_' || md5(p."id" || s."id"),
    p."tenantId", p."classId", s."id", p."academicYear", p."dayOfWeek", p."periodNumber",
    p."startTime", p."endTime", p."subjectId", p."teacherId", p."isBreak", p."breakLabel", NOW(), NOW()
  FROM "periods" p
  JOIN "sections" s ON s."classId" = p."classId"
  WHERE p."sectionId" IS NULL AND p."academicYear" = v_year;

  DELETE FROM "periods" p
  WHERE p."sectionId" IS NULL
    AND p."academicYear" = v_year
    AND EXISTS (SELECT 1 FROM "sections" s WHERE s."classId" = p."classId");
END $$;

-- ─── New uniqueness: composite + partial (Postgres treats NULL as distinct,
-- so the composite index alone would allow two class-wide rows for one slot) ──

CREATE UNIQUE INDEX "periods_tenantId_classId_sectionId_academicYear_dayOfWeek__key"
    ON "periods"("tenantId", "classId", "sectionId", "academicYear", "dayOfWeek", "periodNumber");

CREATE UNIQUE INDEX "periods_classwide_slot_key"
    ON "periods"("tenantId", "classId", "academicYear", "dayOfWeek", "periodNumber")
    WHERE "sectionId" IS NULL;

CREATE INDEX "periods_tenantId_sectionId_idx" ON "periods"("tenantId", "sectionId");
