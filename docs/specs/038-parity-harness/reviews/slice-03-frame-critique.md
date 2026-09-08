---
slice: 038-03 — credential/cookie transport-parity report (feeds E10)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T20:49:07Z
prompt_source: review.py frame-critique <spec> 'transport-parity report' <slice>
---

Frame-critique verdict: **pass** (round 2, independent jig:reviewer, read-only). Round 1 (needs-changes) caught the load-bearing error: AC2's blocked-cohort cell false-greened a real gap ("both fall back to first-party params → no gap"), but airlock does NOT emit Meta's `_fbp`/`fbc` today (gap-map-owned). Fixed into a TWO-owner per-cohort gap ledger and round-2-verified against source:
- Cookieless egress grounded: `core/airlock.js:48-50` sets only method/body/keepalive (no credentials/mode).
- Meta gapMap owns `_fbp`/`fbc` ("chamber cookie-capability follow-up", `descriptors/meta.js:71-72`; connector omits them `meta.js:11-13,74-81`) → dropped on BOTH cohorts.
- GA4 `cid` is genuinely emitted first-party from `_ga` (`cookies.js:30-34` → `map.js:70`), absent from its gapMap → gap-free both cohorts.
- Two-owner split faithful to ADR-0020 commitments 1 + 3 (cross-site cookie → E10; first-party identity → cookie-capability; commitment 3 casts first-party identifiers as the blocked-cohort cookieless path).
The "documented, not live-observed" limitation (cross-site cookie opaque to page JS + absent from a Lighthouse log; live CDP observation = future R5-gated) is honestly deferred; the value is the honest per-cohort gap arithmetic (the blocked-cohort first-party drop is not trivially in the ADR).

Round-2 non-blocking note, folded: `_gcl_*` was miscategorized as a cross-site cookie (E10) — `_gcl_aw`/`_gcl_dc`/`gclid` are FIRST-PARTY cookies gtag sets on the publisher's origin (owner cookie-capability, per ADR-0020 commitment 3); only `IDE`/`fr` are the third-party cross-site cookies (E10). AC1 corrected: owner is fixed by WHERE the cookie lives (vendor origin = E10; publisher origin = cookie-cap), not by vendor — so a future MVP8 Google Ads descriptor won't inherit the miscategorization.
