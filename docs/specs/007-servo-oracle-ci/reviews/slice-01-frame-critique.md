---
slice: 007-01 — `ga4_mp_conformance` oracle component (hermetic + live complement)
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-08-27T19:52:28Z
prompt_source: review.py frame-critique
---

Frame-critique attacked AC1/AC2's gating claim. FINDING (needs-changes): the scaffolded Tier-0 oracle.sh is a weighted MEAN (sum(w*score)/sum(w)), gated `composite >= THRESHOLD` (default 0.5). A hermetic binary component returning 0.0 is diluted by other passing components: with `ga4_mp_conformance:1.0` + `vitest:1.0`, a broken fixture yields composite 1.0/2.0 = 0.5, and 0.5 >= 0.5 PASSES — the seeded failure does NOT flip the verdict. The template reserves rc=2 for env errors only; there is no per-component hard-fail path. A deterministic MUST-pass invariant cannot be one soft term in a mean. A3 (live check credential-free) is well-grounded (R-002) and non-blocking — a residual note, not the flaw. Resolution required: make the servo-unattended gate an AND of binary hermetic checks (THRESHOLD=1.0), or add a template short-circuit, and prove any single 0.0 stays fatal as 07-02 adds components.
