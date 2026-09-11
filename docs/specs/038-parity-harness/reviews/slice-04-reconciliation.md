---
slice: 038-04 — confirm Meta advanced-matching parity (retire the `ud[...]` 026-04 gap)
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-11T21:04:34Z
prompt_source: review.py reconciliation docs/specs/038-parity-harness/spec.md 'advanced-matching parity'
---

Verdict: PASS (on re-verification). Reconciliation artifacts faithful: the deviation log (4 entries) verified against core/airlock.js:208/247, the worker ingestIdentity skip-undefined loop, the shared report.js SCOPE_NOTE, and the ev=PageView negative-witness hardening; the sweep's no-op claims confirmed (oracle.js/redact.js/replay.js/report.js unchanged — redact-both-sides reuses the existing /^ud\[/ rule, no oracle field-class added); no closed-spec (038-01/02/03) record rewritten.
Initial needs-changes (deviation entry 2's false "+ a refinement-todo follow-up" claim for the fbp/_fbp wire-name gap) RESOLVED: added a first-class refinement-todo entry (the AC4 _fbp-vs-fbp wire-name residual, grounded on oracle.js:104 / meta.js:61-65 / the synthetic-fixture guard) and updated the sweep to enumerate five 038-related entries; re-verified pass, no remaining issues.
Non-blocking notes (stand): the new witness file has no own sweep line (covered by deviation entries 1&4); board/front-door regen deferred to the post-DONE close-out.
