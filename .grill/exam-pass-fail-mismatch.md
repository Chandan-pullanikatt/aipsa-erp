# Grill: Exam Pass/Fail Showing Wrong Result
Date: 2026-05-26

## Intent
Fix the "Pass / Fail" status badge on the student profile marks section that incorrectly shows "Fail" for students with good marks.

## Key decisions
- Decision: Treat `passingMarks` as a percentage threshold, not an absolute mark. Fix is `(marksObtained / maxMarks) * 100 >= passingMarks`. Reason: The seed data explicitly sets `passingMarks: 40` on an exam with `maxMarks: 25` — 40 absolute out of 25 is impossible; 40% is clearly the intent. The `calculateGrade` function already uses the same percentage convention. The old check `marksObtained >= passingMarks` was inconsistent with everything else.

## Surfaced assumptions
- The admin UI for exam creation shows "Passing Marks: 40" which reads naturally as "40 out of maxMarks" (absolute), not "40%". This ambiguity caused the bug — whoever coded the UI badge assumed absolute; the seed data assumed percentage.
- `calculateGrade` and the pass/fail badge must use the same interpretation of `passingMarks` or they'll contradict each other.

## Out of scope
- Changing the label in the exam creation UI from "Passing Marks" to "Passing %" (a UI polish, not a correctness fix)
- Fixing manually-hardcoded grade strings in the seed data (e.g., 'C+' which isn't in the grade scale); those are cosmetic seed issues, not bugs users hit in live data
