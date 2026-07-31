-- Allow one parent user to be linked to several guardian rows (one per child)
DROP INDEX IF EXISTS "guardians_userId_key";
CREATE INDEX IF NOT EXISTS "guardians_userId_idx" ON "guardians"("userId");

-- Portal login moves from a random per-student PIN to the school-wide default
-- password pattern. A NULL portalPin now means "using the default"; only a
-- parent-chosen password is stored (encrypted). Old bcrypt PIN hashes are
-- unrecoverable and no longer meaningful, so they are cleared.
UPDATE "students" SET "portalPin" = NULL WHERE "portalPin" IS NOT NULL AND "portalPin" NOT LIKE 'v1:%';
