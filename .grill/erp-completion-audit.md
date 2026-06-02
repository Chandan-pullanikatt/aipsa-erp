# Grill: ERP Completion Audit
Date: 2026-06-01

## Intent
Determine if the AIPSA multi-tenant School ERP is functionally complete and ready to onboard real schools. Not asking about payment/billing — that is a separate phase.

## Constraints
- Solo developer, deployed on DigitalOcean VPS (database now on Neon cloud PostgreSQL)
- No SMS provider available or planned for now
- Payment/billing to schools is a separate concern (phase 2)
- Must be ready for real schools to register, get approved, and use all modules

## Key decisions
- Decision: File attachments stored as external URLs (Google Drive links), not direct uploads. Reason: No file storage provider configured. Alternative considered: Cloudinary/S3 — not implemented.
- Decision: Notifications are email + in-app only, no SMS. Reason: No SMS provider.

## Surfaced assumptions
- The .env file in production still has placeholder SMTP credentials — email is not actually working in production.
- WEB_URL is still set to localhost:3000 — approval email links go to the wrong URL.
- Razorpay keys are placeholder test values — Premium LMS payment will throw a 503 error if triggered.
- The database is Neon cloud (not DigitalOcean self-hosted as originally planned).

## Open questions
- Are the production .env values (SMTP, WEB_URL) actually set on the server, or are they the same placeholder values from the committed .env file?
- Is Premium LMS (Razorpay subscription) needed before launch or is it phase 2?

## Out of scope
- SMS integration (deferred)
- Payment billing to schools for platform subscription (phase 2)
- Direct file upload (teachers use Google Drive links)
