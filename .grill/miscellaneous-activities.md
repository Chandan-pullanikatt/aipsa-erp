# Grill: Miscellaneous Activities
Date: 2026-05-26

## Intent
Track per-student disciplinary records, achievements, and teacher remarks. Any class teacher or admin can add. Feature should be visible on the admin student profile and accessible to teachers via a dedicated student list page.

## Key decisions
- Decision: Three activity types — DISCIPLINARY, ACHIEVEMENT, REMARK. Reason: Maps exactly to the feature spec; covers the full range without over-engineering.
- Decision: Store as a `StudentActivity` model with title, description, date, type, addedBy. Reason: Structured enough for filtering/display, simple enough to not need sub-models.
- Decision: Admin sees activities on the existing student profile page. Teacher sees activities via a new `/teacher/students` page (class-scoped student list + add activity per student). Reason: Teachers have no access to `/school/students/[id]`; a dedicated teacher page is cleaner than expanding their access to the admin route.
- Decision: DELETE is allowed by the record's creator or any admin. Reason: Teachers should be able to correct their own mistakes; admins have full control.

## Out of scope
- Student/parent visibility of activities (no spec for this)
- Editing existing activities (add + delete is sufficient for now)
- Bulk activity import
