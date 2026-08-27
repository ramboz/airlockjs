---
slice: 007-03 — `cwv_budget` oracle component + resolve OQ6 (flicker routing)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-27T20:13:18Z
prompt_source: review.py frame-critique (re-review round 2)
---

Round-2 re-review of revised slice (INP re-pinned to cross-invocation median-of-N delta vs rIC control). VERDICT PASS. Every grounding claim verified against the harness: rig/measure.mjs:33,39,48 confirms one MODE per invocation (one browser, one page); rig/harness.html:74 emits inp_p75 per run so a wrapper can extract it; the rIC-deferred control mode is real — harness.html:51 maps `deferred` to createDeferred, implemented by baseline/patch-datalayer.js:25 on requestIdleCallback. The cross-invocation median-of-N delta vs the deferred control is constructible; the pairing wrapper is named as in-scope work (AC1) and the DoD seeded-INP-delta-regression flip test bounds the tolerance band empirically (not arbitrary). The advisory/human-read framing (kept out of COMPONENTS) is a legitimate register for a noisy near-zero delta (worker ~8ms ties the rIC baseline), not a dodge — routing genuinely never feeds the gating composite. Attacks (a)/(b)/(c) all fail to land. FIX-IN-PASSING notes for implementation: (1) rig/measure.mjs:7 usage comment is stale — advertises MODE=baseline|worker but factories (harness.html:49-53) are naive|deferred|worker; MODE=baseline would crash on undefined factory. The slice correctly uses the rIC-deferred (`deferred`) mode; the wrapper must pass MODE=deferred/MODE=worker, not follow the stale doc string. (2) harness pct() (harness.html:63-67) is a crude nearest-rank p75 over small samples — fine for an advisory delta where both sides use the identical estimator, but the oracle-design ADR should note the p75 is rig-crude, not a calibrated percentile.
