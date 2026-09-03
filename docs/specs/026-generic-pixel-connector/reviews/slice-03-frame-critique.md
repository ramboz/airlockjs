---
slice: 026-03 — the config contract (`PixelVendorConfig`): pin + validate + conformance
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-09-03T01:27:45Z
prompt_source: review.py frame-critique
---

Frame-critique (026-03 — the config contract, pre-implementation) — PASS (first pass, no reframe). All three
attacks refuted against source: (1) the PixelVendorConfig type is DESCRIPTIVE of the shipped interpreter, verified
field-by-field — connector.js:74-82 destructures exactly {name,endpoint,eventMap,paramMap,egressPurposes,endpoints,
capabilities}; eventMap value is genuinely string|null (:128,:140,:142; linkedin.js page_view:null the live proof);
the paramMap {from:static|event|params} vocabulary matches :139-141; the 3 configs conform. (2) The
identity/advanced-matching + POST deferral to 026-04 is a SETTLED, justified decision recorded in the authoritative
spec.md:102-108 (security-critical PII handling — in-chamber hashing + per-field consent + a new governance path;
real-driver-gated; mirrors the accepted 026-02 POST cut; consistent with the maintainer's no-theoretical-tools
thesis) — a known residual, not a fresh flaw; worst case a wrong value-judgment costs a modest slice (the type +
tests are retained + extended by 026-04), not rework. (3) The validator is NOT dead code — AC3 requires it run
{valid:true} against all 3 real configs + AC4 non-vacuous reject tests, exercised day one against the real
archetype (clears the vertical bar for its user, the config author).

Non-frame-fatal must-fixes FOLDED IN pre-implementation: (a) the 3 vendor configs' stale "deferred to 026-03"
forward-refs corrected to 026-04 (AC6; permitted — AC5's empty-diff is connector.js + core/ only, not the vendor
config files, tension resolved explicitly); (b) the validator's vertical anchor hardened to AC3's required
conformance harness (dropped the weak optional-adapter hedge); (c) the validator's deliberately-stricter-than-
interpreter stance documented in JSDoc (the interpreter fails soft, String()s any scalar — connector.js:143,146).
