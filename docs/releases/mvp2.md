# Release Plan: MVP2

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user
decision. **MVP2 does not start until MVP1's risk-retirement bet is retired.**

## Problem / Baseline

- MVP1 proves the runtime and the **wire-protocol** connector archetype (GA4,
  built-from-scratch beacon). It does not prove the runtime hosts the *other*
  shape a real connector takes: a **wrapped vendor SDK** running inside a chamber.
- The connector abstraction (AD-7) is only worth its name if it generalizes
  across both archetypes. MVP2's value is exercising the wrapped-SDK shape, not
  new product surface.

## Appetite

- Prove the connector abstraction generalizes across the **only two shapes it
  needs** (wire-protocol + wrapped-SDK) — the Adobe stack (Analytics + Target via
  alloy) hosted in a chamber, without a breaking change to the connector/capability
  contracts pinned at MVP1. _(Fixed budget TBD — set when MVP1 lands.)_

## Solution Outline

- Run the stock Adobe Experience Platform Web SDK (**alloy**) inside a chamber:
  Analytics events and Target personalization via the Edge Network.
  [R-004](../research/R-004-alloy-in-worker.md) proved feasibility (stock alloy
  boots, configures, and sends an event in a Web Worker with a sync-cache shim;
  personalization runs headless — `renderDecisions:false`, host applies).
- Extend, don't rewrite, the pinned [contracts/](../../contracts/README.md): the
  connector interface and capability API were shaped at MVP1 to anticipate this.
  A break here = the MVP1 contract was wrong (which is exactly what the pinning
  was meant to prevent).

## Risks / Rabbit Holes

- **OQ9 — multi-chamber synchronous host-access (the gating risk).** alloy needs
  synchronous cookie/storage; the sync-cache shim is proven only single-chamber
  (R-004). Two chambers sharing an identity cookie need a coherent synchronous
  view that async write-back cannot give, and SharedArrayBuffer is AD-4-forbidden.
  **A model-agnostic coherency probe must run before the MVP2 capability contract
  freezes.** If it fails, MVP2's whole premise (no-SAB chambers) is at risk.
- **OQ11 / OQ3 — event-payload governance and the event schema.** The
  compromised-connector threat becomes real at MVP2 (vendor code); the payload
  denylist and any pinned schema must be decided here, jointly.
- **Per-connector isolation (ADR-0001/0003 dependency).** The isolation upgrade
  (per-connector confidentiality) must land *with* the first wrapped-SDK
  connector, not after, or the read-boundary controls are nominal.
- Identity resolution (ECID) enters scope at MVP2 (alloy manages it) — reconcile
  with OQ5, which was an MVP1 no-go.
- Target prehiding / anti-flicker is inherently main-thread; keep it out of the
  chamber.

## No-Gos

- Starting MVP2 before MVP1's bet is retired.
- Freezing the MVP2 capability contract before the OQ9 coherency probe runs.
- SharedArrayBuffer / COOP-COEP to get synchronous cross-chamber access (AD-4) —
  unless OQ9 concludes there is no alternative, recorded via ADR.
- Optimizely / VWO (a separate later connector slice, not MVP2).

## Cutline

| Item | Note | Disposition |
|---|---|---|
| OQ9 coherency probe (model-agnostic two-worker cookie test) | Gates the capability contract | **Include — RISK-FIRST** |
| alloy Analytics event via the Edge Network, in a chamber | The wrapped-SDK archetype | Include |
| alloy Target personalization (decisions-as-data; host applies) | Headless mode (R-004) | Include |
| Proof the MVP1 connector/capability contract hosts alloy unchanged | The generalization claim | Include — the release's point |
| Per-connector isolation upgrade | ADR-0001 B-vs-C decision | Include (lands with the first wrapped-SDK connector) |
| Full identity resolution / first-party cookie store | OQ5 | Defer / TBD |

## JIG Handoff

> Non-mutating pointers. Do not start until MVP1 is retired.

- **Precondition spec:** the OQ9 coherency probe → an ADR resolving the MVP2
  isolation model (ADR-0001 B-vs-C) + the synchronous-host-access mechanism,
  before extending the capability contract.
- Resolve OQ11/OQ3 (payload governance + schema) as part of the connector
  contract extension.
- Spec the alloy wrapped-SDK connector against the extended contracts.
- Detailed slices: **TBD** — draft once MVP1 lands and OQ9 resolves.

## Release-Check Criteria

> Advisory; **TBD** until MVP1's oracle infrastructure exists and MVP2 slices are
> drafted.

- alloy runs in a chamber and emits a valid Edge Network interact payload
  (Analytics) and returns Target decisions as data.
- The connector/capability interfaces pinned at MVP1 host alloy **without a
  breaking change** — the generalization claim, proven.
- INP stays protected (the wrapped SDK's work is off-thread; no regression vs
  MVP1's scoreboard).
- `isolation_invariant` holds for the vendor chamber; the OQ9 sync-access
  mechanism is coherent under the probe's concurrent/out-of-band-write tests.

_Last shaped: 2026-08-26_
