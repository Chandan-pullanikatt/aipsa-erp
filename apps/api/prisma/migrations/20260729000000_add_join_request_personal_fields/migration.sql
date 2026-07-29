-- Bring self-registration (class-code) requests in line with the admin admission
-- form: capture the full personal profile on the request so it carries onto the
-- Student record when a teacher approves it.
ALTER TABLE "class_join_requests"
  ADD COLUMN "gender" "Gender",
  ADD COLUMN "bloodGroup" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "photoUrl" TEXT;
