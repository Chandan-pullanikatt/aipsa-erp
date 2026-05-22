# Grill: AIPSA Multi-Tenant School ERP + LMS
Date: 2026-05-15

## Intent
Build a multi-tenant SaaS School ERP + LMS platform for AIPSA (All India Private Schools Association — allindiaprivateschools.org), a large national association of private schools. The platform lets member schools self-register, manage their own operations (students, staff, fees, attendance, exams, LMS), and AIPSA acts as Global Super Admin with platform-wide oversight. Developer is solo, showing weekly progress updates to AIPSA stakeholders.

## Constraints
- Solo developer — no team
- Single DigitalOcean VPS (self-hosted, no managed cloud)
- Zepto Mail for transactional email (already provisioned)
- No Supabase (explicitly rejected by AIPSA)
- Weekly deliverable demos to AIPSA
- No hard deadline, but "ASAP" with weekly updates

## Key decisions
- Decision: Shared PostgreSQL schema with `tenant_id` on every table. Reason: single VPS, solo maintainer — schema-per-tenant means running hundreds of migrations per table change. Alternative considered: schema-per-tenant (rejected for operational complexity at this scale/team size).
- Decision: Start with School Onboarding + Authentication first. Reason: first working demo that makes the platform feel real to AIPSA stakeholders and buys credibility for subsequent weeks. Alternative considered: building all 12 modules in parallel (rejected — not feasible solo).
- Decision: Next.js (frontend) + Node.js/Express (backend API) + PostgreSQL. Reason: developer already knows these well; no learning curve tax on week 1. Alternative considered: Golang backend (rejected — solo dev, new language = 3 weeks lost to learning).

## Surfaced assumptions
- AIPSA initially expected all 12 modules in one week — they underestimate the scope. Developer already pushed back; timeline is now open-ended with weekly updates.
- "Production-ready" in the spec likely means "demo-able and stable enough to show schools" not "live with real school data from day one."
- The 12 Tier 1 modules are the full scope — advanced modules come in later phases.

## Open questions
- What does AIPSA consider a successful Tier 1 completion — a live demo URL, or actual schools onboarded?
- Are there any existing school data or systems that need to be imported/integrated?
- What is the DigitalOcean VPS spec (RAM/CPU) — affects what can run concurrently?
- Will AIPSA handle payment gateway integration for fee collection, or is that deferred?

## Out of scope (Tier 1)
- Advanced modules and additional features (explicitly deferred to later phases)
- Payment gateway integration (not specified for Tier 1)
- Mobile native apps (responsive web only)
