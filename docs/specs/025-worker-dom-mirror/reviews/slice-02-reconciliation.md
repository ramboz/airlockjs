---
slice: 025-02 — the mirror core: synthetic tag off-thread through airlock's own mirror, INP-safe
pass: reconciliation
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-03T00:32:24Z
prompt_source: reconciliation sweep
---

Reconciliation (025-02) — PASS. airlock's OWN bidirectional worker-dom mirror works end-to-end (main→worker event
forward → off-thread compute → worker→main mutation flush → frame-budgeted main-thread apply), and ADR-0014's
central apply-INP bet — flagged UNMEASURED at authoring — is now MEASURED on airlock's own code (AC5a p75=8ms
reproducing 025-01's band, orchestrator-re-run; AC5b a falsifiable heavy-apply budget-boundedness proof). The
mutation-apply safety allowlist gates the real-DOM write surface (hostile ops refused + never crash the batch,
post-remediation). @ampproject/worker-dom is devDep-only (enumerably not imported — AC8). Gate history all durable:
frame-critique PASS (3 rounds — bidirectional channel + the 5a/5b measurement split); compliance NEEDS-CHANGES →
PASS; craft NEEDS-CHANGES → PASS (throw-safety fixed both layers). Promoted: ADR-0014 (central bet now measured;
validated not amended, immutable) + refinement-todo. Toward 025-03: Prism/innerHTML + a full value-level style
sanitizer covering LAYOUT abuse not just URL schemes + id DOM-clobbering hardening + the pinned minimal subset +
the two 025-01 worker-backpressure threads; ambient globals → 025-04; Lever-3 budget; the DOM-chamber build.mjs
bundle entry (shared with the pixel worker). No orphans; no live identifiers; no new runtime dependency.
