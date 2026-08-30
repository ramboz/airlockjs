---
status: DONE
dependencies: [014-01]
last_verified: 2026-08-30
frame_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 014-02 — concurrent-chamber coalescing in core

**Goal:** Carry the concurrent-chamber **mint-coalescing broker** — its in-flight-mint table, the
completed-mint association, **and the reject-path** (012-02's craft fix) — from the rig
(`rig/alloy-coalescing-broker.js`) into `core/`, on top of 014-01's core round-trip dispatch. So two
concurrent core-hosted alloy chambers both first-minting are coalesced by **core's** broker to **one**
ECID in both jars — the 012-02 scenario through `core/`, with the reject-path preserved so a first-mint
dispatch failure can't hang held chambers.

**DoR:**
- ✅ [014-01] DONE — `core/` hosts a wrapped-SDK connector with the round-trip egress dispatch (the
  seam the broker sits on).
- ✅ [012-02](../012-mvp2-alloy-chamber/slice-02-mint-coalescing.md) DONE — the broker (in-flight-mint
  table + completed-mint association), the deterministic gate-able stub, and the **reject-path** (held
  awaiters settle on first-mint dispatch failure; sync-register-before-await invariant) exist in the
  rig to port. [`rig/alloy-xdm-mint.js`](../../rig/alloy-xdm-mint.js) `recognizeInteract` is reused
  verbatim (already import-clean).

**Acceptance Criteria:**

1. **Coalesced through core (ON).** Two concurrent core-hosted alloy chambers, both booted from an
   EMPTY jar and both first-minting, are coalesced by **core's** broker to **one** ECID in **both**
   jars. Observable: `ecidA === ecidB`; exactly **one** identity-mint interact egresses (the second is
   held-in-flight / late-suppressed).
2. **Reject-path preserved.** A first-mint **dispatch failure** settles the held awaiter — the held
   chamber is **rejected** with the error, `completed` is left unpopulated (self-heal), and the suite
   does not hang. Observable: a forced first-mint failure rejects the held chamber within a bounded
   timeout (a regression **hangs the test**, not the suite) — the 012-02 craft fix, in core.
3. **Detector both ways (OFF baseline).** Coalescing **off** reproduces the split-identity fault —
   two chambers, two **distinct** ECIDs, two mint egresses. Observable: `ecidA !== ecidB` and the
   011 identity model reports `fault: split-identity` OFF, no fault ON.
4. **XDM mint-recognition in core.** The broker recognizes an identity-mint via the reused
   `recognizeInteract`; a **non-mint** interact is passed through, **not** coalesced. Observable: the
   non-mint probe is recognized as non-mint and egresses (role passthrough).
5. **Async-only, no SAB (AD-4).** No `SharedArrayBuffer` is constructed on the coalescing path, and
   none is exposed in-context (no COOP/COEP). Observable: `new SharedArrayBuffer` absent on the core
   path; runtime context has none.

**DoD:**
- [x] ACs 1–5 pass through **core's** broker (a `test/` +/or `rig/` harness driving core), green.
- [x] **No GA4 regression**; the round-trip + confinement of 014-01 stay green.
- [x] Reviews: compliance + craft + **arch** (the broker is core concurrency architecture) +
      reconciliation, recorded pass.
- [x] Deviation log + reconciliation sweep; `docs/refinement-todo.md` (e) updated (the reject-path is
      carried into core, still with the `completed`-association invalidation-on-reset note).
- [x] **No live identifiers committed** (redact if validated against real Edge).

### Deviation log

_2026-08-30._
- **Broker made VENDOR-NEUTRAL (arch-review [1], blocker).** The first cut ported the broker into
  `core/` but imported the recognizer from `../rig/alloy-xdm-mint.js` — the only `core/ → rig/` import
  in the repo (architecture.md boundary violation + spec 014's "no rig mirror" thesis). Fixed: the
  broker now takes **injected** `recognize` / `extractIdentity`; the alloy recognizer was relocated
  `rig/alloy-xdm-mint.js → connectors/alloy/xdm-mint.js` (10 importers repointed); a new
  `test/core-boundary.test.js` fails if any `core/ → rig/` import returns. A fix-time scope bug
  (`ecidOf` used the injected `extractIdentity` at module scope) was caught by the ported unit tests +
  fixed by threading it through.
- **Rig reject scenario (implementer).** AC2's reject-path is driven in the rig via a dedicated broker
  + two direct concurrent `handleInterceptedFetch` calls (forced HTTP 500) rather than two full alloy
  chambers — faithful (the chamber's `caps.egress.dispatch` **is** `broker.handleInterceptedFetch`,
  the identical held-awaiter entry point) and exceeding 012-02's unit-only precedent; bounded
  (TIMED_OUT vs hang). The reject-path is ALSO proven at the Node unit level (bounded 2000ms).

### Reconciliation sweep

Parallel-and-minimal holds — `core/airlock.js` + `core/chamber.worker.js` **unchanged** (git diff
empty). New `core/coalescing-broker.js` (vendor-neutral) + relocated `connectors/alloy/xdm-mint.js` +
rig + tests + the boundary test; additive-only. Full suite green (490); the core rig
(`rig:alloy-coalescing-core`, 30 assertions) + the repointed 012-02 rig (`rig:alloy-coalescing`) both
green. `docs/refinement-todo.md` (e) reject-path-in-core recorded; the cross-boundary import is
**resolved** (not tracked debt). **Logged 014-03 follow-ups:** (arch-2) retire the duplicate 012-02
rig broker (`rig/alloy-coalescing-broker.js` — its import was repointed so it still builds); (arch-3)
the seal-binding point (broker-entry vs real-egress) — adjacent to the 014-01 arch-4 follow-up. No
live identifiers (stub-only).

**Anti-horizontal-phasing check:** after this slice, concurrent alloy chambers coalesce through
`core/`'s broker (reject-path included) — ADR-0008's mechanism lives in core, not a rig. Observable
value: the 012-02 scenario, core-hosted, deterministic both ways.
