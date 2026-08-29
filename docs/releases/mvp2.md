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
- **Scope (narrowed 2026-08-28).** MVP2 is the **isolation / generalization
  proof** — *does the wrapped SDK isolate and run?* The **secured I/O seams**
  (ADR-0006/0007 *enforcement*) and the characterization of alloy's config-driven
  behaviour move to **[MVP3](mvp3.md)** — you can't design the seams until MVP2
  has measured what alloy actually collects and where it egresses. MVP2 keeps the
  manifest *declaration shape* (forward-compat scaffolding) so MVP3's enforcement
  is a switch-flip, not a breaking retrofit; the MVP1-pinned seal (host allow-list
  + consent gate) stays on as MVP2's security floor. MVP2 is a **proof, not a
  production rollout**.

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
- **OQ11 / OQ3 — event-payload governance and the event schema → reassigned to
  [MVP3](mvp3.md).** The compromised-connector threat is a *production* concern,
  and the payload denylist is architecturally fragile for a wrapped-SDK (the
  vendor builds the XDM body inside the chamber; stripping at the seal may break
  it). MVP2 characterizes alloy's behaviour; MVP3 designs the governance against
  it, archetype-split (GA4 natural, alloy probe-gated).
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
| Manifest declaration-shape scaffolding (declare endpoints/reads/purposes, ADR-0006/0007) | Forward-compat; **declared, not enforced** in MVP2 | Include |
| Characterize alloy's config-driven behaviour (auto-collected data; egress hosts) | The input MVP3's seam design needs | Include |
| Secured I/O seams — ADR-0006/0007 *enforcement* (authoritative endpoints, payload governance, purpose-vector consent) | The compromised-connector defense | **Defer → [MVP3](mvp3.md)** |
| Full identity resolution / first-party cookie store | OQ5 | Defer / TBD |

## JIG Handoff

> Non-mutating pointers. Do not start until MVP1 is retired.

- **Precondition spec:** the OQ9 coherency probe → an ADR resolving the MVP2
  isolation model (ADR-0001 B-vs-C) + the synchronous-host-access mechanism,
  before extending the capability contract.
- Extend the capability contract only for alloy's *functional* needs (mediated
  sync cookie/storage, context injection, decisions-as-data) **plus the
  declaration shape**; defer the *enforcement* + OQ11/OQ3 governance to
  [MVP3](mvp3.md).
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
- The manifest *declaration shape* (endpoints/reads/purposes) is present and
  forward-compatible, so MVP3 can turn on enforcement without a breaking change —
  enforcement itself is explicitly out of MVP2 scope.

_Last shaped: 2026-08-28_
