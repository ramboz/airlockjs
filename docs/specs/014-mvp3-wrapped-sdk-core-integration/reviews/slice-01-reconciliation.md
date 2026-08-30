---
slice: 014-01 — round-trip egress + generic hosting in core (alloy driver)
pass: reconciliation
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T17:34:41Z
prompt_source: reconciliation sweep (self, orchestrator) — 014-01
---

## Reconciliation — slice 014-01 — **pass**
Deviation log + reconciliation sweep present under the slice heading.
- **Deviations dispositioned:** the {init,driveEvent,getState} host API; the rig-wired AC4 probe
  (transport-agnostic host); the contract-home fixes (egress.dispatch + cookies.reconcile both
  documented + pinned — the arch blocker); the craft hardening (re-entry guard, sink guard, timer
  assertion, bounds). All justified + recorded.
- **Artifact coverage:** parallel-and-minimal verified — read-only core files unchanged (git diff
  empty); new core module + rig + tests + additive contracts only. Full suite green (481); rig green
  (26 assertions). ADR-0010 accepted (the round-trip egress capability formalized, honestly scoped to
  the fetch hops with redirects/pixels a named residual). refinement-todo (a)+(b) resolved.
- **Follow-ups logged (not gates):** arch-2 production-cookie-semantics; arch-3 GrantedCapabilities
  chamber-vs-host mixing; **arch-4 the 014-03 one-seam must host the synchronous unload path +
  keepalive** (load-bearing for 014-03); arch-5 request-side egress-model declaration.
- **Safety:** no live identifiers (stub-only, by construction).
