---
slice: 012-03 — Target personalization, decisions-as-data (headless)
pass: frame-critique
verdict: pass
reviewer: general-purpose (2 rounds)
reviewed_at: 2026-08-30T02:10:46Z
prompt_source: review.py frame-critique
---

**Verdict: pass** — two adversarial frame-critique rounds (independent general-purpose reviewers). The slice was RE-SCOPED first (owner decision 2026-08-29) to build the full CWV-safe DOM-injection capability, not just consume it.

## Round 1 — three findings, all corrected
- **[PRIMARY] CWV-safety was un-gateable as written.** AC3 relied on `observeLayoutShifts` (grep: **prose-only, unimplemented** — an unbuilt import from the external `ramboz/aem-cwv-helper`) + an advisory whole-page Lighthouse CLS *delta* (`cwv-budget.mjs`→`lh-eds.mjs`, non-gating, can't attribute to one injection); the repo's own UC-1 proof (`uc1.mjs` + R-005) **deliberately avoids** quantitative headless layout/paint measurement as unreliable, gating on a **structural** invariant + human screenshot. **Fixed:** AC3 now gates on a deterministic **by-construction structural invariant** (reserved-box geometry + surrounding-content position unchanged reserve→insert), demotes CLS + negative control + screenshot to advisory (OQ6), and removes the false "existing infra" claim.
- **[secondary] `insertAfterInteraction` speculative** (no consumer — UC-1 is above-the-fold, exercises only `reserveSpace`). **Fixed:** scoped out (declared-not-built; only `reserveSpace` built).
- **[secondary] `exposure.js` misfit** (it reads aem-experimentation's `body[data-experiment]` dataset, which an alloy Target proposition doesn't populate). **Fixed:** AC5 rides the generic `handle.push` capture runtime + a **new** alloy-proposition→exposure mapping.

## Round 2 — PASS, one tightening applied
Round 2 verified all three round-1 fixes addressed and confirmed the structural invariant is genuinely deterministic (geometry via `getBoundingClientRect`, not the paint *timestamps* R-005 rejects — so **stronger** than uc1's `performance.now()` ordering gate). One required tightening (gate-enumeration, not a reframe): legs (a)+(b) omitted the **before-paint ordering leg** — a lazy *post-paint* `reserveSpace` would shift content at reserve-time (real CLS) yet still satisfy geometry-equality. **Applied:** AC3 now adds gated leg **(c)** — the box is reserved before `body:appear` (the true uc1 applied-before-paint analog) — and makes explicit the reserve **spec** (selector + `minHeight`) is **eager / config-sourced**, decoupled from the lazy async decision (airlock boots lazy, AD-8; the decision arrives after first paint), so reserve-before-paint is possible and the async gap is covered by `reserveSpace` (CLS half) + main-thread prehiding (perceptual half, OQ6 screenshot).

Premises 3 (decisions additive; pull-vs-push reconciled) + 4 (prehiding main-thread) were sound both rounds.

Recorded by: author, after two independent frame-critique rounds (round 2 pass), with the leg-(c) tightening applied.
