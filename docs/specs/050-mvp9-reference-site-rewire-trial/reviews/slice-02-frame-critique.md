---
slice: 050-02 — measured Lighthouse/TBT + parity evidence + scripted adoption path
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-16T01:41:53Z
prompt_source: review.py frame-critique <spec> 050-02 <slice-02.md> (re-run after reframe)
---

Frame-critique pass (pre-implementation, adversarial) — RE-RUN after reframe. Reviewer: read-only `jig:reviewer`.

VERDICT: pass

The revision closed all four prior `needs-changes` findings, verified independently:

1. **AC2 "second oracle"** → now explicit that `martech.golden.json` is NOT the per-vendor oracle for the four migrated
   vendors (it guards the untouched tail; 050-01 AC4 runs `verify:martech` *minus* the four); per-vendor parity rests on the
   **038 harness**. Grounded: spec 038 carries Meta (038-01/038-04) + GA4 (038-02) oracles plus Ads/Floodlight, so
   "GA4/Meta ride the same engine" holds.
2. **AC1 win framing** → now "airlock-BOOTED, not tags-removed", bounded above by the R-011 −389 ms / −63% TBT suppression
   ceiling, "may be materially smaller". Matches the recorded R-011 experiment.
3. **AC2 Meta identity gap** → now "modulo each connector's OWNED identity gap-map"; airlock's Meta connector is identity-free
   (omits `_fbp`/`fbc`, `ud[em]/[ph]`), scored owned/expected-dropped by the 038 oracle.
4. **AC3/AC5 console access** → two-branch "Access grounding" (developer's own vendor-console access OR own test properties →
   protocol conformance, not intuit-attribution parity; state which). Settled-in-direction by Accepted ADR-0029.

Non-blocking residual note (FOLDED IN): AC5's compressed "developer's access" slightly overstated Branch-1 — consoles for the
four *live* properties (GA4 `G-GCCMSJL6CT`, Ads `AW-1030811807`, Floodlight `DC-1996823`, the Meta pixel) are intuit's vendor
accounts (an org-class grant, not intrinsically the developer's); only the own-test-properties branch is genuinely
zero-dependency, and it yields protocol conformance, not intuit-attribution parity. AC5 now states this explicitly and requires
recording which branch was used (and marking a test-property run as conformance-not-parity). No silent narrowing.
