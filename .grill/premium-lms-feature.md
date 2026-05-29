# Grill: Premium LMS — Paid Video Access for Students
Date: 2026-05-28

## Intent
Add a paid video layer to the existing LMS. Students/parents pay once per academic year via Razorpay and get instant access to recorded class videos. Free students can see a teaser/example video per subject to encourage upgrade. Videos are YouTube/Google Drive links added by the school — AIPSA provides the infrastructure and payment flow.

## Constraints
- Payment must be instant — no admin approval bottleneck after payment
- Razorpay only (one-time order, not subscriptions API)
- Videos are external links (YouTube/Google Drive), not hosted files
- Only students already enrolled in a school on the AIPSA platform can pay
- Per-student, per-academic-year unlock

## Key decisions
- Decision: YouTube/Google Drive links, not hosted video files. Reason: no storage/bandwidth/CDN infrastructure needed. Alternative considered: DigitalOcean Spaces (rejected for now — can migrate later).
- Decision: One-time annual payment per student. Reason: simpler Razorpay integration (Orders API only). Alternative considered: monthly subscription (rejected — Subscriptions API, auto-debit mandates, cancellation handling).
- Decision: student pays AIPSA/platform directly via Razorpay, not the school. Reason: instant unlock, no admin bottleneck. Alternative considered: school admin manually unlocks after offline payment (rejected — wastes student time).
- Decision: school admin sets the premium price per tenant. Reason: different schools may price differently.
- Decision: each LMS material can be marked as "premium" by the teacher/admin. Free materials stay visible to all. One material per subject can be marked as "free preview" to tease premium content.

## Surfaced assumptions
- The school admin will upload YouTube/Drive links as part of their LMS content management.
- Multiple students can pay and access the same video links — no per-student link generation needed.
- Razorpay test keys are already available or will be added to .env.

## Open questions
- What happens if a student's admission year rolls over — does their premium access expire automatically at year end, or does the school admin reset it?
- Does the school get a revenue share from each student payment, or does all payment go to AIPSA?

## Out of scope
- Video hosting on own servers (for now)
- Razorpay Subscriptions / recurring billing
- Admin approval flow for payments
- Refund handling UI (handled directly via Razorpay dashboard)
