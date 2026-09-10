---
slice: 042-02 — generalize the GET-critical unload flush to pixel
pass: compliance
verdict: pass
reviewer: general-purpose (independent-review, Opus)
reviewed_at: 2026-09-10T20:01:15Z
prompt_source: review.py implementation
---

VERDICT: pass

REASONING:
All six ACs are met. core/airlock.js adds the connector==="pixel" ->
requestMapper: createPixelConnector(connectorConfig||{}).handle branch (mirroring 042-01's gtag
wiring), fully retires the workerMappedGetEgress boolean (gate `if` collapsed to
`if (typeof addEventListener === "function")`, pushCritical drop-block removed, invariant comment
left), and the six flipped/new pixel-seam tests exercise each AC against a real
visibilitychange/pagehide flush. Ran the suite: pixel-seam 23/23; ga4-gtag-seam / rum-unload-
dispatcher / airlock-dispose 27/27 (AC6 regression parity holds). No bugs, no security/robustness
concerns, no design-principle violations (main-thread unload mapping is the pre-existing disclosed
teardown exception; the consent seal criticalDispatchGated + governParams still apply).

SPECIFIC ISSUES:
- (non-blocking, disclosed) AC3 no-op test is vacuous under pre-042-02 code (a drop and a []-no-op
  are observationally identical to fetchMock alone); non-vacuous in the DELIVERED config because
  the gate is retired (deleting the pixel requestMapper -> unmapped event falls through to mapToMp
  POST -> fetch fires -> reds). The stats().fastDispatched/fastDropped===0 assertions add real
  signal via createCriticalDispatcher's empty-result tolerance. AC5 carries the non-vacuous load.
- (observation) AC5 parity is tautological-by-construction for pixel (pure function of the shared
  metaConfig, no ctx) — exactly what the spec anticipates ("parity holds unconditionally on the
  shared config"); still a valid integration guard (independent createConnectorHost construction;
  would red on a reshaped config or governance divergence — value/currency/content_name confirmed
  absent from DEFAULT_DENYLIST). Meets AC5 as written.

RECONCILIATION NOTES:
- Sweep table still all _TODO_ placeholders — discharge at reconciliation: architecture.md OQ16 /
  "ring tail dropped" framing, CLAUDE.md primer "GET-critical flush deferred" note (stale — 042
  closes both connectors), inbox.md pixel-GET follow-on (resolved), refinement-todo GET-critical
  -> RESOLVED, docs/specs/README.md board regen.
- adapters/eds/index.js bootGa4Gtag JSDoc (:536-558) still names the retired workerMappedGetEgress
  + a pixel-drop posture — doubly stale; route to reconciliation (add a sweep row + fix).
- The 4th comment-only workerMappedGetEgress reword (helix-rum doc comment) is disclosed in the
  deviation log; no further action.
