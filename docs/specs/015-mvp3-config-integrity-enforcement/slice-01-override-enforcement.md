---
status: DRAFT
dependencies: []
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 015-01 — override enforcement at the dispatch seam

**Goal:** Make the seal **bite** for config-integrity: wire 013-03's demonstrated control
(`rig/config-integrity.js`) into `core/`'s wrapped-SDK dispatch seam (014-01's
`caps.egress.dispatch`), so that before the orchestrator does the real fetch it **re-derives the
outbound `configId` to the host-pinned datastream** (`pinnedDispatchUrl` — evasion-proof) and **fails
closed** (holds, no egress) on an absent/duplicate `configId` (`checkConfigIntegrity`). A compromised
core-hosted chamber that re-points its alloy datastream to an attacker tenant on the *allowed* host
then egresses to the **host** tenant, not the attacker's — the same-host tenant re-route 013-03
confirmed live is neutralized. This is MVP3's **first enforcement teeth**; keep it narrow (one control,
one seam) so the seal's machinery is proven small.

**DoR:**
- ✅ [014-01](../014-mvp3-wrapped-sdk-core-integration/slice-01-roundtrip-egress-core.md) DONE — the
  `caps.egress.dispatch` seam exists in `core/wrapped-sdk-host.js` (the single chokepoint), gate-able
  per [ADR-0010](../../decisions/adr-0010-roundtrip-egress-capability.md).
- ✅ [013-03](../013-mvp3-live-alloy-reprobe/slice-03-config-integrity.md) DONE — the control
  (`checkConfigIntegrity` + `pinnedDispatchUrl` + `outboundDatastreams`, fail-closed, pollution-aware)
  is proven (7 creds-free tests), and the threat is confirmed live (AC1: real Edge routes by `configId`
  on the shared host). This slice **wires** it, not re-litigates it.
- ✅ The host pin is available: the orchestrator sets `config.datastreamId` (host-owned, chamber-
  immutable post-boot) — `connectors/alloy/connector.js` / the `createWrappedSdkHost` config path.

**Acceptance Criteria:**

1. **The control lives in `core/`.** `rig/config-integrity.js`'s `checkConfigIntegrity` /
   `pinnedDispatchUrl` / `outboundDatastreams` are relocated into `core/` (vendor-neutral —
   datastream-pinning is a generic seam control; the alloy-specific `configId` param name is the
   wire detail). No `core/ → rig/` import (the 014-02 boundary rule; `test/core-boundary.test.js`).
2. **Wired into the dispatch seam (OVERRIDE).** In `core/wrapped-sdk-host.js`'s dispatch path, **before**
   `caps.egress.dispatch` does the real fetch, the outbound interact URL is **re-derived to carry
   exactly the host-pinned `configId`** (`pinnedDispatchUrl(url, pinned)`), discarding whatever the
   chamber supplied. Observable: a re-pointed / polluted outbound `configId` reaches Edge as the
   **host** datastream — the override is applied, not a parse-and-compare.
3. **Fail closed (HOLD).** An outbound interact with **no** `configId` or **duplicate** `configId`
   params is **held** — no real fetch is dispatched. Observable: `checkConfigIntegrity` returns `hold`
   → the dispatch is refused (the chamber's `sendEvent` settles rejected, per 014-01's timeout/reject
   surface), and no egress leaves for it.
4. **The host pin is orchestrator-owned.** The pinned datastream is the **host-set** `config.datastreamId`,
   threaded into the host (not read from the chamber's outbound request). Observable: chamber code
   cannot influence the pin; only the orchestrator's config sets it.
5. **E2E: the re-route is neutralized (the seal bites).** A core-hosted chamber configured to re-point
   its `configId` to an ATTACKER datastream on the same host egresses to the **HOST** datastream
   (overridden). Observable in a `test/` +/or `rig/` harness driving the core seam: the dispatched URL's
   `configId` === the host pin, ≠ the attacker's; parameter pollution corrected; absent → held.
6. **The config-integrity ADR is authored + Accepted.** The decision — **seam-side datastream override
   + fail-closed at the dispatch, host-owned config necessary-not-sufficient** — is recorded (a new
   ADR; ADR-0006's endpoint ceiling is tenant-blind and does not cover it, 013-03). The ADR names the
   scope (wrapped-SDK datastream; GA4/sync-unload out of scope) + the residual (the `orgId`/body vector
   013-03 named). Authored as this slice's first step, frame-critiqued + accepted.

**DoD:**
- [ ] ACs 1–6 pass — a re-pointed core-hosted chamber egresses to the host tenant (overridden), absent/
      polluted held; the honest path unchanged; green against the stub.
- [ ] **No regression** — 014-01/02's dispatch + coalescing stay green; GA4 untouched; full suite green.
- [ ] Reviews: compliance + craft + **arch** (a core enforcement seam + a new ADR) + reconciliation,
      recorded pass.
- [ ] Deviation log + reconciliation sweep; `docs/refinement-todo.md` config-integrity item resolved
      (013-03's requirement now enforced); the config-integrity ADR indexed.
- [ ] **No live identifiers committed** — synthetic datastreams only (like 013-03); the stub path
      commits no ids.

**Anti-horizontal-phasing check:** after this slice, a compromised chamber **cannot** exfiltrate to an
attacker tenant on the allowed host — its egress is forced to the host datastream at the core seam.
Observable value: the 013-03 threat, neutralized in `core/` (not just demonstrated).
