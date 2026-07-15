-- Home-schooling moved to its OWN database (see prisma/homeschool/schema.prisma).
-- Drop the home-schooling tables from the ERP database. CASCADE clears their
-- foreign keys to `tenants` automatically. Data is demo-only and re-seeded in the
-- new home-schooling database.
DROP TABLE IF EXISTS "hs_lesson_progress" CASCADE;
DROP TABLE IF EXISTS "hs_enrollments" CASCADE;
DROP TABLE IF EXISTS "hs_subscriptions" CASCADE;
DROP TABLE IF EXISTS "hs_learners" CASCADE;
DROP TABLE IF EXISTS "hs_lessons" CASCADE;
DROP TABLE IF EXISTS "hs_modules" CASCADE;
DROP TABLE IF EXISTS "hs_courses" CASCADE;
