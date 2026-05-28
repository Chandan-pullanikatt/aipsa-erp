# Grill: Student Profile View
Date: 2026-05-26

## Intent
Extend the existing `/school/students/[id]` page with three new read sections below the current editable content: attendance summary, exam marks, and fee history. Admin sees everything about a student in one place without navigating away.

## Key decisions
- Decision: Extend same page, not a new route. Reason: Admin already lands here when clicking a student; editing functionality stays intact; no new navigation required.
- Decision: Attendance shows current-month summary (Present/Absent/Late counts + %) plus compact list of exception days (absent/late only). Reason: Full history is too noisy for a profile view; exceptions are what matter.
- Decision: Marks show one card per exam (newest first), subject rows inside each (name | marks/max | grade | pass/fail; "Absent" if absent). Reason: Raw data the teacher entered — no computed aggregation since grading systems vary by school.
- Decision: Fees show a summary bar (Total Due | Total Paid | Balance) derived from FeeStructure minus FeePayments, then a payment history table grouped by academic year (newest first). Reason: Due dates aren't in the schema yet so installment-level breakdown is premature.

## Out of scope
- Miscellaneous activities section (no DB model yet)
- Installment-level fee breakdown (due dates not built)
- Full attendance history / calendar view
