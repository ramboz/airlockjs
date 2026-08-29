---
slice: 011-02 — out-of-band write coherency
pass: reconciliation
verdict: pass
reviewer: general-purpose (jig reconciliation pass)
reviewed_at: 2026-08-29T03:43:20Z
prompt_source: review.py reconciliation docs/specs/011-mvp2-coherency-probe/spec.md 011-02
---

# Reconciliation review — slice 011-02

**Verdict: pass.** Every deviation-log claim verified against code and reviews; the
doc changes are faithful and honest; no scope creep or over-build.

- Both **APPLIED** nits verified: the compliance nit — `crossSiteNegativeHolds` now
  gates on `crossSite?.routed === true` (feeding `outOfBandBoundariesHold` → `pass`)
  — matches the compliance review; the craft banner fix (`011-01` →
  `011-01 + 011-02` in `rig/coherency-model.mjs:1` and `test/coherency-model.test.js:1`)
  matches the craft review.
- The three forward-logged craft nits (items 1/3/4) match the craft review verbatim;
  the harness/model/test code corroborate every "instrument extended" finding.
- The OQ9 annotation faithfully records the measured out-of-band result (both
  positive JS sources detect only via `document.cookie` polling; option-A fault,
  option-B self-heal; network `Set-Cookie` a confirmed negative boundary) and
  correctly hands the formal go/no-go + resolving ADR to 011-03.
- Scope appropriate — the rig extends 011-01 in place with exactly the ops the ACs
  need (no speculative knobs/abstraction); the sweep `no-op`s correctly defer
  ADR/architecture/memory to 011-03.
- Context (not an omission): `git diff main...HEAD` lists 011-01's committed
  deliverables because 011-01 landed on the branch (not yet `main`) and all of 011-02
  is still uncommitted — those files are outside this slice's sweep by design.

Reviewer: general-purpose (jig reconciliation pass).
