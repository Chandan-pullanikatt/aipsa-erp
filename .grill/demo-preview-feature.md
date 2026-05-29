# Grill: Demo Preview Feature for School Decision-Makers
Date: 2026-05-28

## Intent
Build a public-facing demo page that lets school principals/decision-makers preview the student portal experience with one click — no sign-up, no password. The goal is a sales asset the team can drop in a WhatsApp/email and the principal sees the real product in 10 seconds.

## Constraints
- Must be publicly accessible (any URL, no login wall)
- Must show the actual student portal, not a mockup
- Full interaction allowed (homework, LMS progress toggling, tabs)
- Uses the existing St. Mary's Academy demo data

## Key decisions
- Decision: one-click auto-login rather than a public static preview. Reason: avoids rebuilding all portal views as public pages; principal sees the exact same UI a real student sees. Alternative considered: fully public unauthenticated pages (rejected — double the work, goes stale).
- Decision: dedicated demo student record in Class 7A (feeAccessOverride: true, all fees cleared). Reason: Class 7 has the richest data (timetable, LMS, exams, homework). Alternative considered: reusing Rohan Mathew's record (rejected — his userId is already linked to the parent demo account).
- Decision: small "Demo Mode" banner in the student portal. Reason: principal needs to know they're seeing sample data, not a real student account.

## Surfaced assumptions
- Demo data is on the live server (St. Mary's Academy seed already run).
- Multiple simultaneous visitors will share the same demo student's interaction state — acceptable for demo context.
- No session expiry needed beyond the standard JWT window.
