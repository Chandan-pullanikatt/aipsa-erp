# Grill: AIPSA Panel Demo Readiness
Date: 2026-05-20

## Intent
Get the AIPSA super admin panel to the same quality level as the school-side modules before an AIPSA stakeholder demo. Demo flow: school admin view → teacher view → parent view → student view → AIPSA super admin panel last.

## Constraints
- Must match the existing UI/UX design system exactly (green sidebar, same card patterns, same color tokens)
- No new API endpoints — must work with what's already built
- Subscription/billing management is out of scope for this phase (no DB model exists)
- Solo developer; needs to be demo-ready fast

## Key decisions
- Decision: Build a proper AIPSA sidebar layout (layout.tsx) instead of inline page headers. Reason: existing school-side uses a layout.tsx with sidebar — AIPSA panel should feel equally complete. Alternative considered: just improving the existing plain header pages.
- Decision: Add a school detail page at /aipsa/schools/[id]. Reason: AIPSA needs to click into individual schools during demo to show full oversight. Without this, the panel feels like a read-only list.
- Decision: Inline approve/suspend confirmation on schools list instead of a modal. Reason: faster to build, sufficient for demo context.
- Decision: Frame subscription management as Phase 2. Reason: no DB schema for it; building fake UI would be worse than acknowledging the gap.

## Surfaced assumptions
- AIPSA will be evaluating the platform by clicking through all five role views in sequence — they're not just checking a screenshot.
- The demo is a controlled presentation (developer driving), not AIPSA clicking freely — so client-side-only route protection is acceptable for this phase.
- The AIPSA panel is the last thing shown, meaning it needs to land well as the "platform authority" view after everything else has impressed them.

## Open questions
- Does AIPSA expect revenue/subscription tracking in Phase 1, or can that be explicitly scoped to Phase 2?
- Are there any serious security concerns (plaintext portalPin, non-httpOnly JWT cookies, no Next.js middleware) that need to be fixed before real school data goes in?
