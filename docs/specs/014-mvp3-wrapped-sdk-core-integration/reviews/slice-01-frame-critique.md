---
slice: 014-01 — round-trip egress + generic hosting in core (alloy driver)
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T15:36:15Z
prompt_source: review.py frame-critique docs/specs/014-mvp3-wrapped-sdk-core-integration/spec.md 014-01 slice-01-roundtrip-egress-core.md
---

## Frame-critique — slice 014-01 (round-trip egress + generic hosting in core)

**Round 1 verdict: needs-changes** (general-purpose reviewer, bounded ≤8 files: core/airlock.js,
core/connector-host.js, core/chamber.worker.js, connectors/alloy/*, ADR-0004). Three load-bearing
findings + two well-disposed; all applied.

- **[1] "one egress model" imprecise (load-bearing) → FIXED.** After 014 core holds TWO egress
  *models* (GA4 fire-and-forget + alloy round-trip); neither collapses into the other. What 014
  unifies is the **dispatch SEAM** + the **LOCATION** (no rig mirror), plus the hosting path — NOT
  the models. The seam must gate **two request shapes** (`EgressRequest` + raw intercepted fetch);
  "one model" invited enforcement that only understands `EgressRequest`. **Fix:** retitled to "one
  dispatch seam, one hosting path (no rig mirror)"; Overview reframed (models coexist; seam+location
  unify); the two-shapes seam made explicit.
- **[4] GA4-entanglement sequencing risk (load-bearing) → FIXED.** `createAirlock` hardcodes ONE
  GA4 worker + a GA4-shaped API + a `ready`-only `onmessage`; grafting alloy INTO it forces touching
  GA4, making "no GA4 regression" harder than stated. **Fix:** 014-01 retargeted to a **new sibling
  core module** (`core/wrapped-sdk-host.js`) that owns the round-trip dispatch; `core/airlock.js` +
  `core/chamber.worker.js` are **read-only** until 014-03 converges them. The **single seam is the
  014-03 end-state**, not 014-01's (after 014-01/02 core has two dispatch sites) — stated in the spec.
- **[3] contract-home deferred behind a malformed binary (load-bearing) → FIXED.** "contracts XOR
  seal-gate" conflated *declaration home* with *enforcement point*, and option (b) contradicted AC5's
  own Observable. **Fix:** settled at spec level as **declared-AND-gated** — a first-class
  `caps.egress.dispatch(req) → Response` capability with a documented `contracts/` home AND
  seal-gating on the manifest; AC5 now **implements** the settled surface (lands the gate-able
  surface, not the teeth). The formalizing ADR is authored as 014-01 implementation's first step.
- **[2] vertical-slice value nit → SHARPENED.** It IS vertical (the product gains round-trip egress
  + wrapped-SDK hosting for the first time; the rig proof was never shippable), but the anti-horizontal
  check read as location-motion. **Fix:** value restated as "the product gains a capability," not
  "same behavior relocated."
- **[5] confinement over-framed as a risk → DOWNGRADED.** Confinement is chamber-side
  (`applyEgressConfinement` in the worker scope), location-independent. **Fix:** AC4 + the Assumptions
  bullet downgraded to a **cheap regression re-run**, not a live risk.

### Net
The frame was mostly honest (premise 2 soundly vertical, premise 5 a cheap re-run), but three
load-bearing items reshaped it: the precise unification target (seam+location, two request shapes),
the sibling-module target that keeps GA4 untouched until 014-03, and the declared-AND-gated capability
settled at spec level so enforcement specs bind to a stable surface.
