# Timetable Automation — Design & Implementation Plan

**Status:** Phase 0 in progress
**Owner:** Engineering
**Last updated:** 2026-06-24

## 1. Goal

Let a school administrator click **"Auto-generate"** and receive a complete, conflict-free
weekly timetable for every class — a draft they can review, tweak in the existing editor, and
publish. Today timetables are built entirely by hand in
[`school/timetable`](../apps/web/app/(dashboard)/school/timetable/page.tsx).

## 2. Why an algorithm, not an "AI API"

Automatic timetabling is a classic **Constraint Satisfaction Problem (CSP)** — the same family as
exam scheduling and graph colouring. The right tool is a deterministic algorithm, not an LLM:

| | Algorithm (chosen) | LLM / "AI API" |
|---|---|---|
| Correctness | **Guarantees** hard constraints or reports infeasibility | Can produce plausible-but-wrong grids (double-booked teachers) |
| Cost | Free, runs on our server | Per-call cost, rate limits |
| Privacy | No student/staff data leaves our infra (matters for multi-tenant) | Data sent to a third party |
| Speed | Sub-second for a typical school | Slow, non-deterministic |

AI is reserved for a later, optional convenience layer (natural-language tweaks like
"move all PE to the afternoon") — never the core solver.

## 3. What already exists

- **`Period`** model — the timetable cell (class, day, periodNumber, start/end, subject, teacher, break).
- **`Subject`** is already per-class and carries an optional `teacherId` → this *is* the
  teacher→subject→class assignment. No join table needed.
- Manual grid editor, bulk save, teacher-schedule view, and **double-booking conflict detection**
  ([`timetable.service.js`](../apps/api/src/services/timetable.service.js)).

## 4. Data model changes (additive, non-breaking)

### 4.1 `Subject.periodsPerWeek` (new field)
How many periods per week the subject needs in its class. The (class, subject, teacher,
periodsPerWeek) tuple fully describes one demand the generator must satisfy.

### 4.2 `TimetableConfig` (new table — one per school per academic year)
The school's bell schedule / grid template — the cells the generator fills.

| Field | Type | Notes |
|---|---|---|
| `workingDays` | `Json` | e.g. `["MONDAY", … , "SATURDAY"]` |
| `slots` | `Json` | `[{ periodNumber, startTime, endTime, isBreak, breakLabel }]` |
| `maxPeriodsPerDayPerTeacher` | `Int` | soft cap (default 6) |

`Json` is used (rather than a relational `TimetableSlot` table) because slots are always read/written
as a whole; it keeps the migration small. Can be normalised later if we need to query individual slots.

### 4.3 `TeacherAvailability` (new table — unavailability only)
Default = available everywhere; insert a row only to **block** a slot.

| Field | Type | Notes |
|---|---|---|
| `teacherId`, `academicYear`, `dayOfWeek` | | |
| `periodNumber` | `Int?` | `null` = whole day off; else a specific period |
| `reason` | `String?` | optional |

**Total change: 1 field + 2 tables.** Rooms/labs are deliberately deferred to a later phase.

## 5. The generator algorithm

**Unit of generation = the whole school for one academic year.** Because all classes share one
teacher pool, classes cannot be solved independently — a teacher booked in 5A at period 2 must be
free everywhere else at that slot.

**Approach: constraint-based greedy placement + backtracking** (a list-scheduling / DSATUR-style
heuristic — the standard, proven method):

1. **Expand demands.** For each `Subject`, create `periodsPerWeek` lesson units (class + subject + teacher).
2. **Order most-constrained-first.** Lessons whose teacher has the least availability / highest load
   go first — this single heuristic prevents most dead-ends.
3. **Place each lesson** in the best feasible cell:
   - **Hard (never violated):** class cell empty · teacher not booked in *any* class that slot ·
     teacher available · subject gets exactly its count · breaks untouched.
   - **Soft (scored):** spread a subject across days · cap same-subject repeats/day ·
     core subjects earlier · minimise teacher idle gaps · even daily load.
4. **Backtrack** when a lesson has no feasible cell, under a bounded iteration/time budget.
5. **Randomised restart with a seed** → powers a "Regenerate" button and reproducibility.
6. **Infeasibility report** if the budget is exhausted: return the partial result + a plain-English
   reason ("Math needs 6 periods but the assigned teacher has only 4 free slots") so the admin fixes
   inputs instead of hitting a black box.

**Output** reuses the existing `bulkSaveTimetable` per class. Plain JavaScript, no external solver for
v1; a CSP/SAT library (`logic-solver`) is an optional later optimisation.

## 6. API surface

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/api/timetable/config` | any | read bell schedule (returns a default if unset) |
| PUT | `/api/timetable/config` | admin | save bell schedule |
| GET | `/api/timetable/availability` | admin/teacher | list a teacher's blocked slots |
| POST | `/api/timetable/availability` | admin | block a slot |
| DELETE | `/api/timetable/availability/:id` | admin | unblock |
| — | `/api/exams/subjects` (existing) | admin | now also accepts `periodsPerWeek` |
| POST | `/api/timetable/generate` *(Phase 1)* | admin | run generator → `{ drafts, report }` |

## 7. UI (Phase 0 input screens + Phase 1 button)

- "Periods/week" field on the subject form.
- Bell-schedule config screen (extend the existing "Configure Periods" panel; persist via `/config`).
- Teacher-availability editor.
- "Auto-generate" button → draft preview with warnings → "Apply" / "Regenerate".

> Note: `apps/web` runs a customised Next.js — read `node_modules/next/dist/docs/` before frontend work
> (see [`apps/web/AGENTS.md`](../apps/web/AGENTS.md)).

## 8. Up-front validation (prevents frustration)

Before generating, warn if:
- Σ `periodsPerWeek` for a class > available (non-break) cells in the grid.
- A teacher's total weekly load across classes > their free slots.
- A subject has no teacher or no `periodsPerWeek`.

## 9. Phasing

| Phase | Deliverable |
|---|---|
| **0 — Foundations** | Schema + migration · config & availability API · `periodsPerWeek` on subjects · input screens |
| **1 — Engine** | Generator service, hard constraints, save drafts, basic report, "Auto-generate" button |
| **2 — Quality** | Soft-constraint scoring, "Regenerate", full infeasibility report |
| **3 — (optional) AI** | Natural-language adjustments |

## 10. Risks / open questions

- **Per-school vs per-grade bell schedules** — v1 assumes one grid per school per year; revisit if
  schools need grade-specific grids.
- **Split subjects / multiple teachers per subject** — v1 = one teacher per (class, subject); model a
  many-to-many later if needed.
- **Backtracking budget** — needs tuning against real school sizes; instrument generation time.
