---
slice: 004-03 — GA4 ctx from `_ga` cookies (mediated cookie capability)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (adversarial frame-critique)
reviewed_at: 2026-08-27T04:07:33Z
prompt_source: review.py frame-critique docs/specs/004-uc2-ga4-eds/spec.md cookie slice-03-ga4-cookie-ctx.md
---

# 004-03 frame-critique — VERDICT: PASS

The load-bearing assumption (the community-derived _ga/_ga_<stream> grammar) checked
out as stated (GA1 last-two-segments; GS1 dot-separated; GS2 $-separated s-prefixed)
and is defensively framed — fixtures-as-assumptions, null-and-fallback, never-throw —
so further drift misfires safely. Host-side sourcing is genuinely grounded (map.js
JSDoc + capability.d.ts "backed by the orchestrator on the main thread") and aligns
with ADR-0003 minimization.

Three findings, all folded into the slice before READY_FOR_REVIEW:
1. On a gtag-free site (the headline deployment) the session "fallback" is the
   STEADY-STATE path — nothing writes _ga_<stream>, so an MPA mints a fresh session
   per page until a session-persistence decision. Declared as a limitation; the
   generated client_id's cookie is now PINNED: written as `_ga` in GA1 format
   (bidirectional gtag continuity), defensive never-overwrite.
2. Missing consent assumption declared: the seal gates egress only; the identity
   write is consent-ungated in MVP1 (parked with OQ7/consent scope).
3. Honesty fix: Safari ITP ~7d is the operative continuity bound (not Chrome 400d);
   GS1/GS2 drift wording moved to the _ga_<stream> half of AC1.
