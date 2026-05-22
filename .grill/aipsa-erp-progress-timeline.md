# Grill: AIPSA ERP Progress & Timeline
Date: 2026-05-18

## Intent
Build a precise, hour-by-hour plan to complete all 12 Tier 1 modules of the AIPSA Multi-Tenant School ERP + LMS so the developer knows exactly what to build next at every point, and AIPSA gets a realistic delivery timeline.

## Constraints
- Solo developer, 10 hours/day, 6 days/week = 60 productive hours/week
- Stack is fixed: Next.js + Express + PostgreSQL + Prisma (no Golang, no Supabase)
- Weekly demos to AIPSA stakeholders — each week must produce something visible
- Self-hosted on DigitalOcean VPS, no managed infra to lean on
- Must not break what already works (login, register, shell dashboards)

## Key decisions
- Decision: Build modules in dependency order (SIS first, portals last). Reason: Student data is the core reference point for Attendance, Fees, Exams, and both portals — building out of order means rewriting. Alternative considered: building portals early for stakeholder visibility.
- Decision: Skip automated tests for now. Reason: Solo dev, time-constrained, AIPSA needs working features over test coverage at this stage.
- Decision: 25% time buffer baked in. Reason: Developer is new to multi-tenant patterns; debugging + integration time consistently underestimated on first SaaS builds.

## Surfaced assumptions
- AIPSA believes "foundation is done and we're on track" — this is technically true but the gap to Tier 1 completion is ~4 weeks of full-time work, which has not been communicated explicitly.
- "Done" for a module = working API + functional UI + tenant-isolated data. Not polished, not tested, but usable.
- Developer knows the stack but has not built multi-tenant SaaS before — each new Prisma model needs careful tenant_id wiring.

## Open questions
- Does AIPSA have a hard deadline for Tier 1 completion, or is the weekly cadence open-ended?
- Is file upload (LMS PDFs/videos) going to local VPS storage or an external service like S3/R2?
- Will Parent accounts be self-registered or created by School Admin?
