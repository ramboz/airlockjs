---
slice: 004-04 — end-to-end GA4 + before/after Lighthouse
pass: compliance
verdict: pass
reviewer: general-purpose (independent)
reviewed_at: 2026-08-27T15:12:35Z
prompt_source: review.py implementation docs/specs/004-uc2-ga4-eds/spec.md Lighthouse <deliverables>
---

# 004-04 compliance — VERDICT: pass

All five ACs met, tests non-vacuous. AC1 worker-cycle discriminator is SOUND: the CTA
click takes no manual flush, rides the real idle-drain, and the beacon reaches collect
WHILE ALIVE (no unload dispatched) — which the ring-tail flush (fires only on
visibilitychange/pagehide) provably cannot satisfy (verdict ac1_worker_path_proven).
AC2 fast path genuine (synchronous keepalive; teardown-window proxy; current
page_location). AC3/AC4 real off/on Lighthouse rig, median+spread, TBT the
runtime-attributable number. AC5 contracts/push-api.md amended (prose only). Orchestrator
independently re-verified: 72/72 tests; lh:eds TBT delta 0 / CLS 0 / perf 77→77 within
band; rig:e2e PASS. DoD items "spec Findings/Outcome" + "mvp1 UC-2 row" are the
orchestrator's reconciliation job, done there.
Non-blocking notes folded at reconciliation: unloadCritical dead-config pruned; workFactor
pruned (OQ12); navigatesAway/opensElsewhere hardened (protocol/modified/_blank/download);
stale comment fixed.
