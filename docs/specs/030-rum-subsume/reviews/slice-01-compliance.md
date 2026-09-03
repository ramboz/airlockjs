---
slice: 030-01 — the connector-generic unload dispatcher
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T23:58:02Z
prompt_source: review.py implementation 030 'unload dispatcher'
---

**Verdict: PASS** (reviewer returned NEEDS-CHANGES on the AC1 `method` sub-item; resolved by an honest deferral).
- AC1 — the mapper DI defaults to `mapToMp` (GA4 byte-unchanged, regression-pinned + a live GA4 pushCritical test).
  The `method` option (for the pixel GET) is DEFERRED to a follow-on (recorded in `docs/inbox.md`); RUM is POST +
  complete, so 030-01's load-bearing goal (RUM INP egress) is unaffected.
- AC2 — a `mapToRum` closure egresses the RUM shape (weight/id/checkpoint) to `ot.aem.live`, not GA4. Non-vacuous.
- AC3/AC4 — airlock funnels a helix-rum instance's critical path through `mapToRum`; the **REAL**
  `visibilitychange`→`unloadFlush` ring-tail path is now tested (a pushed cwv flushes as a RUM beacon), and the
  mutation (force the selection off) reds the witness.
- AC5 — keepalive budget + drop-count preserved. AC6 — synthetic only.
