---
slice: 042-01 — GET-critical dispatcher + ga4-gtag unload flush
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique subagent, Opus)
reviewed_at: 2026-09-10T18:39:47Z
prompt_source: review.py frame-critique
---

VERDICT: pass

REASONING:
The single highest-risk load-bearing assumption is A1 — that
`createGa4GtagConnector(connectorConfig).handle` reconstructed on the main thread
produces byte-identical output to the worker chamber. Attacked via
clone-vs-live-reference divergence, session-state staleness, and consent
freshness; it survives on the evidence: both the worker and the main-thread
mapper consume the same immutable boot-time `ctx` snapshot (no 017-01 ctx-resend),
`handle` is a pure/stateless function, and `connectorConfig` is verifiably never
mutated post-boot. A2 is correct as stated. The ring-tail / pushCritical /
egressPurposes plumbing the approach depends on is grounded in the code, not
merely asserted. The frame is exceptionally well-grounded and survives the
strongest attack.

SPECIFIC ISSUES (note, not a block — folded into the spec before implementation):
- AC5's original byte-parity was tautological (the requestMapper IS
  `createGa4GtagConnector(cfg).handle`, so asserting against it compares a
  function to itself). FIXED: AC5 now asserts the flushed GET URL against the
  WORKER path `createConnectorHost(createGa4GtagConnector, connectorConfig)
  .routeBatch([descriptor])`'s `ready[0].url`, and records the residual that
  true worker-vs-main parity holds only while `connectorConfig.ctx` is a frozen
  boot snapshot (a hermetic Node test can't catch a real-Worker structured-clone
  divergence; a future 017-01 ctx-resend into the worker without a matching
  main-thread refresh would silently break it). Also folded into parent spec A1.

RESIDUALS CARRIED FORWARD:
- The fetchInit-sharing decision (move to core/egress.js, import into
  core/airlock.js) is sound and cycle-free since airlock.js already imports from
  egress.js.
