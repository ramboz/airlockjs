---
status: Accepted
dependencies: [adr-0007, adr-0023, adr-0026]
last_verified: 2026-09-14
frame_review: true
---

# ADR-0027: OneTrust as a boot(config) composite governance field (single subscription by construction)

## Status

Accepted (2026-09-14)

> **Review provenance.** The decision was ratified through spec **048-03**'s adversarial passes — a two-round slice
> frame-critique (which rejected the guard-based precedence of Option A, see below) plus the arch pass, which explicitly
> recommended recording it as an ADR (a new public config-contract surface with a real rejected alternative). This ADR was
> then separately frame-critiqued in its own right (two rounds, 2026-09-14, evidence at
> `reviews/adr-0027-frame-critique.md`): round 1 caught a stale "schema done" consequence (a fix-round timing race), round 2
> confirmed the frame sound once the schema `$def` + drift cross-check landed.

## Context

MVP8's end-to-end ad-conversion boot layer ([spec 048](../specs/048-ad-connector-boot-wiring/spec.md)) needs a single,
page-level way to feed OneTrust consent into a multi-connector `boot(config)` composite, so that a mid-session OneTrust
**accept** flushes the [spec 045](../specs/045-consent-hold-until-granted/spec.md)-held Google Ads **and** Floodlight
beacons across **all** booted connectors ("the OneTrust-accept flow").

Two pieces already exist. [Spec 047](../specs/047-onetrust-consent-input-driver/spec.md) / [ADR-0026](./adr-0026-onetrust-consent-input-source.md)
shipped the OneTrust driver (`drivers/consent/onetrust.js`) and a **per-connector** wiring seam: `bootGa4Core`'s
`opts.onetrust` derives the boot vector (`resolveOnetrustBootConsent`) and subscribes (`subscribeOnetrustConsentChanges`) →
that one connector's `handle.setConsent` (047-02). And `createComposite.setConsent` (`adapters/eds/index.js`) already fans a
consent update to **every** member handle. The open question this ADR settles: how does `boot(config)` wire OneTrust so one
change reaches **all** connectors **exactly once**, without stranding any?

## Decision Options Considered

### Option A: generalize the per-connector `opts.onetrust` seam; rely on the driver's idempotency guard for precedence
Thread `onetrust` into sub-boots (and/or wire both per-connector and composite) and let
`subscribeOnetrustConsentChanges`'s idempotency guard (no double-register on the same `onetrust`/`win` object) de-conflict,
with "composite wins" as the intended precedence.
- **Pros:** reuses 047-02's exact seam; adds no new config surface.
- **Cons:** **Broken — this is the frame-critique's load-bearing finding.** The guard is **first-writer-wins keyed on object
  identity** (`drivers/consent/onetrust.js` sets `__onetrustConsentChangeWired` / `__onetrustOptanonWrapperWired` on the
  passed objects), and `boot(config)` constructs sub-boots **before** `createComposite` exists — so a per-connector
  subscription (e.g. a ga4 sub-boot's `opts.onetrust`, reachable via the entry `...rest`) registers **first**, and the later
  composite subscription silently **no-ops**. A mid-session accept then fans out only to that one connector's `setConsent`,
  never `composite.setConsent` → the Google Ads + Floodlight held beacons **never flush** (the exact failure the capstone
  exists to prevent). The guard **cannot express precedence** at all: it only suppresses a duplicate on the *same* object;
  two *different* `onetrust`/`win` objects both fire. Precedence-via-guard is unachievable.

### Option B: `onetrust` as a top-level `boot(config)` governance field; the composite is the SOLE subscriber, by construction
`config.onetrust` is a declarative governance **input** (a sibling of `consent` / `consentStrict` / `payloadDenylist`). When
present, `boot(config)` derives the boot-time vector into `governance.consent` (threaded to every connector) and — **after**
`createComposite(booted)` — wires **one** `subscribeOnetrustConsentChanges({ …, onChange: (v) => composite.setConsent(v) })`.
The composite is the sole subscriber guaranteed **structurally**: `boot(config)` never threads `config.onetrust` to a
sub-boot, and **strips** any per-connector `onetrust` from a connector entry before dispatch — so no sub-boot ever subscribes.
- **Pros:** precedence is true **by construction**, not by a guard that cannot express it; one subscription fans to all
  members via the existing `composite.setConsent`; additive + back-compat (absent `onetrust` → byte-unchanged); the direct
  `bootGa4Core({ onetrust })` caller path (047-02) is unchanged.
- **Cons:** adds a public config-contract surface (the pinned `instrumentation-config.schema.json` must enumerate it — done,
  with a cross-check guarding drift); a per-connector `onetrust` placed in a config **entry** is silently ignored (stripped)
  — the direct-boot path is the only per-connector route; a re-boot lifecycle residual (the composite's subscription is not
  unsubscribed on `dispose()` — inherited from 047-02, benign: `setConsent`-after-dispose is main-thread/worker-free, no throw).

## Recommended Decision

**Option B.** `onetrust` is a top-level `boot(config)` governance field; the composite is the sole OneTrust subscriber,
guaranteed by construction (don't-thread + strip), not by the driver's identity-keyed idempotency guard.

## Consequences

**Becomes easier:**
- A single page-level `config.onetrust` wires the whole MVP8 OneTrust-accept flow across every booted connector.
- Adding a connector needs no OneTrust change — the composite `setConsent` fan-out already reaches it.

**Becomes harder:**
- A per-connector OneTrust map within one composite is not expressible via config (the composite subscription is page-level);
  the direct `bootGa4Core({ onetrust })` path remains for the single-connector case.
- The re-boot unsubscribe residual (the driver has no unsubscribe primitive) must be tracked (see Open questions).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **`createComposite.setConsent` fans to every member** — verified 2026-09-14 (`adapters/eds/index.js`, it calls each
  `c.handle.setConsent(v)`); the basis for "one composite subscription reaches all connectors."
- **The driver's guard is first-writer-wins by object identity** — verified (`drivers/consent/onetrust.js`); the basis for
  rejecting Option A.
- **`boot(config)` constructs sub-boots before `createComposite`** — verified; why a composite-level subscription runs last
  and a per-connector one would win.

## Kill criteria

- If a real use case needs **different** OneTrust group→purpose maps **per connector** within one composite, the single
  page-level composite subscription must be revisited (today the map is page-level, resolved once into `governance.consent`).

## Open questions

- **Re-boot unsubscribe.** `subscribeOnetrustConsentChanges` has no unsubscribe primitive, so a second `boot()` leaves the
  prior composite's subscription installed (benign today — `setConsent`-after-dispose does not throw). Inherited from 047-02's
  per-connector path; tracked in `docs/refinement-todo.md`. Resolving it means growing the 047 driver an unsubscribe seam.
