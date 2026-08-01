-- Staff/teacher photo for the HR directory and ID cards. Lives on `users`
-- rather than `staff_profiles` because admins also have one, and the directory
-- lists them from the user record. Students keep their own `students.photoUrl`.
ALTER TABLE "users" ADD COLUMN "photoUrl" TEXT;
