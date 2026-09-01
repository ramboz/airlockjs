---
slice: 022-04 — CWV checkpoint via `web-vitals` (native runtime capture)
pass: reconciliation
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-01T17:50:26Z
prompt_source: review.py reconciliation
---

Reconciliation (022-04) — PASS. Additive (no core/ touched); 108/108 (65 in the targeted re-run) + lint clean. AC1 grounded from node_modules/web-vitals types (LCP/CLS/INP scalar sets recorded in Findings). All deviations logged: (a) main-thread capture — an accepted grounded deviation (a Worker can't observe the LCP/CLS/INP PerformanceObserver entry types; INP-safety inherited from web-vitals's whenIdleOrHidden-deferred design, not airlock's off-thread architecture); (b) 022-05 (interaction/lifecycle checkpoints) recorded as a new 022-03 dependency; (c) production-wiring fork carried to 022-03; (d) flat {name,value,...scalars} vs the stale enhancer's nested {cwv:{NAME:value}} — a NAMED wire-shape residual; (e) projectCwv's shallow filter drops longestScript's 2 sub-scalars (minor, named). CARRIED FORWARD to 022-03's DoR (edited this landing): the cwv wire-shape + live-AEM-collector acceptance is a creds-gated, load-bearing pre-cutover check — a rejection narrows the whitelist to enhancer-parity (022-04's fallback), not a blocker. web-vitals dependency + lightweight-decision recorded; mvp4.md row updated. No live identifiers.
