---
status: DONE
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 037: The 1.0 API pin (MVP6 capstone)

> Freeze the STABLE public surface adopters can rely on, and say — explicitly — what is NOT yet frozen. The
> [MVP6 release plan](../../releases/mvp6.md) names this the capstone: *"pin the 1.0 API surface … the connector
> interface, capability API, `push()` surface."* Owner decision (2026-09-05): **(1)** the multi-connector
> instrumentation-config surface (`window.__airlockConfig` / `boot(config)`) **stays EXPERIMENTAL** for 1.0 — freeze
> only the stable core; **(2)** 037 **pins the API** (a capstone ADR + contract-stability guards); the actual v1.0.0
> version-bump / tag / dist release cut is a **separate later step**, NOT this spec.

## Overview

The framing already exists: `docs/architecture.md` (§ "Five surfaces, in priority order", ~:57-63) names the frozen
contract set, and ~:65-69 explicitly carves the instrumentation config OUT ("PRE-1.0 … the MVP6 1.0 API pin owns
freezing it"). 037 makes that intent **enforced + recorded**: a capstone ADR stating the 1.0 contract, and
contract-stability guards enforcing the surfaces not yet guarded.

**FROZEN at 1.0 (the stable surface):**
1. **GA4 Measurement Protocol** — `contracts/ga4-mp-request.schema.json` (+ its `.md`); the wire beacon shape.
2. **The `push()` API** — `contracts/push-api.md`: `push()`/`pushCritical()` are synchronous, **return nothing**,
   drop-not-throw on malformed input (ADR-0002 O(1) hot path; ADR-0004 unload-critical). (034-03 reverted the brief
   count-return to void — this pins that.)
3. **The connector interface** — `contracts/connector.d.ts`: `ConnectorFactory` → `{ manifest, init, handle }`,
   `ConnectorManifest` (`name`/`events`/`reads`/`capabilities`/`endpoints?`/`purposes?`), `AirlockEvent`,
   `EgressRequest` (+ `core/connector-host.js`'s `routeBatch` `{ready, dropped}`).
4. **The capability API** — `contracts/capability.d.ts`: `CapabilityRequest` (what a connector declares) +
   `GrantedCapabilities` (what the host grants), ADR-0006 grant law `granted = declared ∩ allowed`.
5. **The seam drivers** — `contracts/seams.d.ts`: `DecisionSourceDriver`/`EgressDriver` (+ their request/result types)
   — architecture.md's surface #5, **present but currently unguarded** by contract-stability.
6. **The adopter boot layer** — the two entrypoints that install `window.airlock`: `bootEdsAnalytics()` (GA4
   back-compat) and `boot(config)` (the composite), and the installed **handle shape**
   `{ push, pushCritical, setConsent, getState, flushNow, stats, dispose }`. Currently pinned only *behaviorally*
   (`test/push-contract.test.js`, `test/eds-boot.test.js`), never by a surface guard — 037's main net-new freeze.

**EXPERIMENTAL — explicitly NOT frozen at 1.0 (carved out, per owner decision + architecture.md:65-69):**
- The **instrumentation-config schema** (`window.__airlockConfig` / `boot(config)` — `connectors[]`, per-`type`
  fields, `placements`, …; `contracts/instrumentation-config.schema.json`, which already self-declares "PRE-1.0, NOT
  frozen"). It is recent (033/034) and still settling; freeze it in a later minor.
- The **standalone per-connector boot handles** beyond the two that install `window.airlock` — their shape *varies*
  (pixels lack `pushCritical`, alloy lacks `flushNow`, helix-rum adds `sampled`); left unfrozen with the config layer.
- **`composite.accepts(name)`** — see the decisions below.
- The **host-internal `cookies.reconcile`** + its 035 scope-coupling — host-side, not a connector-facing grant; unfrozen.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- Grounded (read 2026-09-05): the frozen-five framing (`docs/architecture.md` ~:57-69, incl. the config carve-out);
  the boot entrypoints + `installOnWindow` + the two window.airlock handle shapes (`adapters/eds/index.js` — `boot`
  ~:1457/handle ~:1178-1208, `bootEdsAnalytics` ~:492/handle ~:450-458, `installOnWindow` ~:310-315); `push()`/`pushCritical()`→void
  (`contracts/push-api.md`; composite `:1186-1195`, the 034-03 void-revert); the already-guarded surfaces
  (`test/contract-stability.test.js` pins `capability.d.ts` + `connector.d.ts` text only — `seams.d.ts`,
  `pixel-connector.d.ts`, and the boot/handle shape are NOT guarded); the config schema's own PRE-1.0 self-declaration
  (`contracts/instrumentation-config.schema.json:4-5`); ADRs 0002/0003/0004/0006/0007/0010/0016 already define parts of
  the contract.
- **The open decisions 037 must LAND (the frame-critique + arch review ratify):**
  - **`composite.accepts(name)` (034-03 flag, refinement-todo:547-549) — proposed: INTERNAL.** It is currently BOTH a
    real method on the composite handle (`:1202`) AND the internal deferred-emit-ref target used by the alloy exposure
    reporter. Proposal: keep it OFF the frozen 1.0 handle contract — an internal fan-out detail (couples to connector
    vocabulary). Whether to *physically* remove it from the installed handle (bind the exposure ref to a local/internal
    predicate) or keep the method but document it "not part of the 1.0 surface (unfrozen, may change)" is the
    frame-critique/arch call; the lean is physical removal (a 1.0 freeze is the moment to shrink the public surface).
  - **The 035 `reconcile`/`grantedCookieNames` coupling (arch #1, refinement-todo ~:94 iii) — proposed: reconcile stays
    HOST-INTERNAL + unfrozen.** `caps.cookies.reconcile` is host-wired, not connector-granted; the 1.0 freeze pins the
    connector-facing capability surface and leaves reconcile (+ its scope coupling) host-internal, so no fail-open
    contract ships. Ratify.
  - **Composite read-namespacing / `sampled` surfacing (refinement-todo:462-466, trigger = the 1.0 pin) — proposed: NOT
    frozen** (config-/handle-layer, rides the experimental carve-out).

## Decomposition

**SPIDR — Rules, no spike** (the 1.0 contract is a set of Rules over EXISTING, proven surfaces; MVP1–5 built them,
this pins them). One cohesive capstone slice: the decisions are interlocking (the frozen set, the carve-out, and the
three open rulings are one coherent "what is 1.0" statement), and the enforcement (the ADR + the contract-stability
guards + the `accepts` resolution) is small and shares that one contract. (If the frame-critique finds the `accepts`
physical-removal materially larger than a pin, it splits into its own slice; the default is one slice.)

## Slices

- [037-01 — the capstone 1.0-API-pin ADR + contract-stability enforcement (frozen surface guarded; config carved out; accepts/reconcile ruled)](slice-01-api-pin.md)

## Amendments

> **Amendment (2026-09-07, [ADR-0018](../../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) — reframe re-read; this spec's work is unchanged).** What 037 pinned is the **stable core**, not "1.0" in the release sense. Since the owner's 2026-09-05 reframe, "1.0" means *adoptable with confirmed parity* (ADR-0018), cut when MVP9's release-check passes; MVP6 ships as **v0.6.0**. The "v1.0.0 version-bump/tag/dist cut as a separate later step" that this spec deferred is **retired** — superseded by the v0.6.0 cut. The frozen surface, the guards, and the three rulings are untouched; only the "1.0" label decouples from the pin (title and prose read historically).
