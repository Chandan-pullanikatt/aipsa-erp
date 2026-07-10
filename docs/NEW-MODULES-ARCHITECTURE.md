# New Modules — Architecture & Rationale

_Internal engineering reference. Every design decision below carries its "why" so future
changes are cheap and nobody has to re-derive intent. This is not a management deck._

Source: management feature request (KPI reporting, competitions, paid classes, store,
counseling, events, branding) + tech-lead Santo's KPI module breakdown + `docs/dailyreport.xlsx`.

Guiding directive from management:
1. **Do not break existing features.** → Everything here is **additive**: new tables, new
   routes, new pages. No existing model, route, or column is modified destructively.
2. **Flexible so we can change coding later.** → We do **not** build 8 bespoke features.
   We build **2 config-driven engines** + 1 reporting module and express every requested
   item as *data*, not new code.
3. **Teacher/school-friendly.** → Reuse the existing dashboard shell, auth, and notification
   UX the schools already know. No new mental models for staff.

---

## The central decision: one "Programs & Registrations" engine, not 8 features

Nearly every requested item is the **same shape**:

> a catalog entry → someone registers → (maybe) pays → confirmation → admin gets notified

| Requested item | Type | Paid? | Notes |
|---|---|---|---|
| Sports / Olympiad / Scholarship / Coloring | COMPETITION | yes | sub-events via ProgramItem |
| Arts Festival (multiple items/categories) | COMPETITION | yes | each category = ProgramItem, pay per item |
| 1-to-1 Tuition | TUITION | yes | needs teacher matching (extra layer) |
| Teacher Training | TRAINING | yes/free | |
| School Leadership Training (Principals) | TRAINING | yes/free | audience = leaders |
| Parental / Student Counseling | COUNSELING | free **and** paid | must alert admin on click |
| General Event Registration + Youth First Marathon | EVENT | yes/free | marathon = first live instance |
| Education Excellence Conclave | EVENT | yes/free | optional "School Development Fund" flag |

Building these as one engine means: adding the 9th, 10th, 20th program later = **inserting a
row**, not shipping code. That is precisely the "flexible to modify later" the directive asks for.

### Why not extend `SchoolEvent` / `HsCourse` instead?
- `SchoolEvent` is a school calendar/gallery entity (media, dates) with **no registration or
  payment** concept. Bolting paid registration onto it would overload it and risk the existing
  events feature (violates directive #1).
- `HsCourse` is the **global B2C homeschool catalog** with its own subscription model. Different
  audience, different billing. Reusing it would entangle two products.
- So: a **new, purpose-built engine** that *borrows the proven patterns* from both (global-vs-tenant
  catalog split from `HsCourse`; one-time Razorpay order + HMAC verify from `hsSubscription.service`).

---

## Data model — Programs & Registrations

```
Program            (the catalog entry — what you can register for)
 ├─ tenantId?      null = AIPSA-global (conclave, marathon, trainings, pre-school);
 │                 set  = school-specific (that school's sports day, its counseling)
 ├─ type           COMPETITION | TUITION | TRAINING | COUNSELING | EVENT
 ├─ category       finer label, free text/enum (SPORTS, OLYMPIAD, ARTS_FESTIVAL, ...)
 ├─ title, description, bannerUrl
 ├─ fee            0 = free (e.g. free counseling); >0 = paid
 ├─ audience       STUDENT | PARENT | TEACHER | PRINCIPAL | ANYONE  (who it's for)
 ├─ capacity?, opensAt?, closesAt?, isActive
 ├─ requiresTeacherMatch  (true for 1-to-1 tuition)
 └─ metadata Json  escape hatch for per-program fields WITHOUT schema changes
                   (e.g. { "schoolDevelopmentFund": true } for the conclave)

ProgramItem        (optional sub-choices within a Program)
 ├─ programId
 ├─ name           e.g. "Solo Singing", "Maths Olympiad", "100m Sprint"
 └─ fee?           overrides Program.fee for this item

Registration       (always tenant-scoped: belongs to whoever registered)
 ├─ tenantId, programId, programItemId?
 ├─ registrantUserId, studentId?   (student the reg is for, if applicable)
 ├─ status         PENDING | CONFIRMED | CANCELLED
 ├─ paymentStatus  NOT_REQUIRED | PENDING | PAID | FAILED
 ├─ amount, razorpayOrderId?, razorpayPaymentId?
 ├─ assignedTeacherId?   (filled by teacher-match flow for tuition)
 └─ formData Json  flexible per-program answers WITHOUT schema changes
```

**Why `metadata`/`formData` as `Json`:** the requests keep adding one-off fields ("School
Development Fund", arts-festival categories, marathon t-shirt size). Modelling each as a column
means a migration per request. A `Json` bag absorbs them; we promote a field to a real column
only when we need to query/aggregate on it. This is the main lever for "change later cheaply."

**Why nullable `tenantId`:** mirrors the existing `HsCourse` (global catalog) vs tenant-data split
the codebase already uses — consistent, and it lets AIPSA run cross-school programs (conclave,
marathon, pre-school initiative) from one row while schools still run their own.

**Payment reuse:** identical one-time Razorpay order + HMAC-signature verify flow as
`hsSubscription.service.js` / `premiumLms.service.js`. No webhooks, no Razorpay Plans. Free programs
skip payment entirely (`paymentStatus = NOT_REQUIRED`) and confirm immediately.

**Counseling admin-alert requirement:** on every counseling registration we fire
`notify.notifyRoles(tenantId, ['SCHOOL_ADMIN'], 'PROGRAM_REGISTRATION', …)`, which the existing
dispatcher fans out to in-app + SMS + Email + WhatsApp per admin preference. No new channel code.

**1-to-1 tuition teacher matching:** `requiresTeacherMatch` programs create the Registration, then
either (a) an admin allocates a teacher from the backend (sets `assignedTeacherId`), or (b) later, a
teacher self-claims. Kept as a nullable field + status now; a richer scheduling layer can come later
without reworking the base.

---

## Study Materials Store (mini e-commerce)

**Reuse, don't rebuild.** `StoreItem` + `Purchase` already exist (admin records a sale). Gaps for
the request: student-initiated online purchase, item images, stock, and an online payment path.

- Extend `StoreItem` additively: `imageUrl`, `stock?` (null = unlimited). Existing `category` enum
  (`UNIFORM | BOOKS | MATERIALS | OTHER`) already covers books/uniforms/belts/badges — add
  values if needed, no rename.
- Add an online-checkout path on `Purchase`: `paymentStatus`, `razorpayOrderId/PaymentId`. The
  current admin-recorded flow stays exactly as-is (a manually recorded sale = `PAID` immediately).
- Deliberately **basic** per the directive — flat item list, quantity, pay, done. No cart/coupons/
  shipping engine unless later asked.

---

## KPI & Reports module (Santo's 5 blocks, grounded in `dailyreport.xlsx`)

The xlsx is a **Principal's Daily School Monitoring Report**: columns
`DAY | DATE | AREA | SL.NO | PARTICULARS | REPORT | REMARKS | FOLLOW-UP`, grouped into AREAS
(School Academics, Hostel, Administrative) each with fixed PARTICULARS (attendance, fees,
discipline, transport, cleanliness, …). Some particulars are numeric KPIs (teacher/student
attendance, fee collection vs dues); most are narrative + follow-up.

Santo's 5 blocks map to:

| Santo's block | Our implementation |
|---|---|
| Data Sources / Data fields | `KpiArea` → `KpiParticular` catalog, **seeded from the xlsx** |
| KPI Builder | admin CRUD over Areas/Particulars per school (hide Hostel if none = flexibility) |
| Reports Module | `DailyReport` + `DailyReportEntry` (one row per particular) + xlsx upload path |
| Formula Engine | derived metrics over the *numeric* particulars (attendance %, collection %) |
| KPI Dashboard | per-school + cross-school trends for management |

```
KpiArea        tenantId?, name, order, isActive          (seeded: Academics/Hostel/Admin)
KpiParticular  areaId, name, inputType(TEXT|NUMBER|CURRENCY|STATUS), order, isKpi, isActive
DailyReport    tenantId, reportDate, preparedById, status(DRAFT|SUBMITTED), summary?
DailyReportEntry reportId, particularId, valueText?, valueNum?, remarks?, followUp?
```

**Open question for Santo (does not block build):** should the Formula Engine/Dashboard compute
only over the numeric particulars (attendance, fees) while the rest stay logged text + follow-up?
We build the log + numeric aggregation now; richer formulas slot into the Formula Engine later.

**Why `inputType` + `isKpi` flags:** lets one catalog hold both narrative rows and machine-readable
KPIs, so the Formula Engine knows what it can safely aggregate. Non-KPI rows are still captured for
the follow-up/monitoring purpose the sheet exists for.

---

## Build order (each stage independently shippable)

1. **Programs & Registrations engine** (backend) — unlocks 6 of the 8 requests at once.
2. **Study Materials Store** extension — smallest delta, reuses most.
3. **KPI & Reports** module — independent; blocked only on Santo confirming numeric-vs-narrative scope.
4. **Frontends** — student registration/store/KPI entry + admin management, on the existing shell.
5. **Content sections** (Pre-School Start-up page, Social Media/Marketing duties) — mostly static;
   Pre-School banner goes to `apps/web/public/images/programs/preschool-startup.jpg` (awaiting asset).

## Migrations
All changes are **additive** (new tables + new nullable columns). DB is production Neon, so we
**generate** migrations and apply them deliberately — never auto-run `migrate deploy` against prod
from a dev session. New nullable columns + new tables are backward-compatible with running code.
