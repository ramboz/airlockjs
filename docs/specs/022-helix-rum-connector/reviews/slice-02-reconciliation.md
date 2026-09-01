---
slice: 022-02 — error checkpoints + sampling-rate fidelity
pass: reconciliation
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-01T16:09:46Z
prompt_source: review.py reconciliation
---

Reconciliation (022-02) — PASS. Additive-only; 69/69 targeted+regression green (independently re-run); lint clean. AC1 design point resolved not left open (params||payload bridge, grounded against GA4/alloy precedent); the weight-vs-rate precedence fork decided locally + pinned by test (aem.js gives no guidance — a legitimate local call). DEFAULT_WEIGHT now derives from RATE_WEIGHTS.medium (single source of truth, same value). A stale in-code "022-02" enhancer reference was corrected to "022-04" per the reshape. mvp4.md row annotated (error+sampling done; CWV=022-04). The open production-wiring fork (the window-listener capture) is cross-referenced to 022-01's deviation log, not duplicated. No live identifiers.
