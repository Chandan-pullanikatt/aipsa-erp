# Grill: Student Profile 404 + Slow Load
Date: 2026-05-26

## Intent
Fix the admin student profile page where Exam Marks and Fee Account sections never load (infinite spinner), and understand what's causing the 5–10 second delay on other sections.

## Key decisions
- Decision: Fix the URL paths in the admin student profile page, not the server mount points. Reason: Every other page in the frontend already uses `/fees/` and `/exams/` (plural); the student profile page was the only outlier. Changing server mounts would break all working pages.
- Decision: Treat the 5–10 second delay as a separate concern (likely Neon cold-start on the serverless DB); do not bundle it with the 404 fix.

## Surfaced assumptions
- The student profile page was written in isolation and never tested against live data, so the URL mismatch went unnoticed until now.
- The error was completely silent — `.catch(console.error)` swallowed the 404 and left the spinner running forever with no user-visible message.

## Out of scope
- Fixing Neon cold-start latency (infrastructure concern, not a code bug)
- Replacing `.catch(console.error)` with proper error states (future UX improvement)
