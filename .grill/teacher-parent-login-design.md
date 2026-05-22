# Grill: Teacher & Parent Login Design
Date: 2026-05-18

## Intent
Define exactly how teachers and parents get login accounts on the AIPSA ERP, so the implementation covers both admin-initiated and self-service flows without ambiguity.

## Key decisions
- Decision: Two join paths — magic link (admin-initiated) and school join code (self-service). Reason: Some schools will onboard staff via invite, others will distribute a code and let people join. Alternative considered: magic link only — rejected as too slow for bulk onboarding.
- Decision: School join code is a separate short alphanumeric code per tenant (e.g. `STJOHN-4X9K`), not the slug. Reason: Slug is public/guessable; join code must be private and regeneratable. Stored on the Tenant model.
- Decision: Parent-to-student linking uses admission number + portal PIN (auto-generated per student, visible only to School Admin). Reason: Prevents random parents from linking to wrong students using just the school code. Alternative considered: Admin manually links after signup — rejected as too manual.
- Decision: Student logins are skipped for now. Reason: Out of scope for Tier 1; optional feature deferred.
- Decision: Teachers self-configure their own profile (classes/subjects) after joining. Reason: Admin doesn't need to know class assignments at invite time — teacher knows their own schedule.

## Surfaced assumptions
- Magic link flow: Admin enters email → system creates inactive User + sends setup email → teacher/parent sets password → account activated.
- School code flow: User enters join code → verifies school → enters details + sets password → account created active.
- Parent who self-joins must still link to a student via admission number + portal PIN before they can see any student data.
- Both flows produce the same end result: an active User record linked to the correct tenant with the correct role.

## Out of scope
- Student login accounts (deferred, optional)
- Admin approval step for self-joined accounts (trust the join code)
- Age-based logic for student portal access
