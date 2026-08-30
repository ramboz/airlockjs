---
slice: 014-01 — round-trip egress + generic hosting in core (alloy driver)
pass: arch
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T17:33:13Z
prompt_source: review.py arch docs/specs/014-mvp3-wrapped-sdk-core-integration/spec.md 014-01 <deliverables>
substrate: non-interactive
---

## Arch review — slice 014-01 — **needs-changes → blocker fixed → pass**
Two highest-value premises sound: the injected-`dispatch` chokepoint is correctly located + gate-able
(the load-bearing MVP3 property — "the best decision in the slice"), and the sibling split is coherent
with correct core/ placement (worker-side `connector-host.js` vs main-thread `wrapped-sdk-host.js`),
the two-dispatch-site parallel intentional + convergence-friendly, not calcified. The serialized
response shape is right (structured-clone-safe, matches the chamber, additive + pinned).

- **[1] BLOCKER → FIXED** — `caps.cookies.reconcile` was a co-equal main-thread sink to `egress.dispatch`
  but had no contract home or pin — the same "undocumented parallel" AC5/ADR-0010 exist to kill,
  reintroduced in-slice. **Fix:** documented `cookies.reconcile?(setCookie): void` in
  `contracts/capability.d.ts` (co-equal to `egress.dispatch`, framed against `sync.writeSync`'s
  queued write-back) + pinned in `contract-stability`.

Concerns/flags LOGGED (not gates) → deviation log + refinement-todo:
- **[2]** `reconcileForBrokerJar` strips `Secure`/`SameSite`/`Domain` unconditionally — a localhost/http
  rig accommodation; a production **https** jar must PRESERVE them (stripping `Secure` is a downgrade).
  Now documented in the contract; tracked as a 014 production-cookie-semantics follow-up.
- **[3]** `egress.dispatch` lives in `GrantedCapabilities` (chamber-facing) but is consumed host-side —
  `GrantedCapabilities` now mixes chamber-facing + host-side; open question for 014-03.
- **[4]** the "one seam" must reconcile **THREE** fetch sites — `airlock.js` (hardcoded fire-and-forget),
  `egress.js` (injectable but SYNCHRONOUS, unload fast path), `wrapped-sdk-host.js` (async). An async
  `dispatch(req)→Promise` cannot host the synchronous unload path, and `EgressDispatchRequest` carries
  no `keepalive` (load-bearing, ADR-0004). 014-03 must account for it.
- **[5]** `CapabilityRequest.egress:boolean` can't distinguish the two egress models — deferred to
  014-03 by ADR-0010's open question.
