---
status: DRAFT
skill:
use_cases: [UC-1]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 015: config-integrity enforcement — the seal's first teeth

## Overview

This is **MVP3's first enforcement spec** — the seal starts to bite. Spec 014 landed the
wrapped-SDK **dispatch seam** in `core/` (`core/wrapped-sdk-host.js`'s `caps.egress.dispatch`, the
single chokepoint every intercepted interact crosses, [ADR-0010](../../decisions/adr-0010-roundtrip-egress-capability.md)),
declared **gate-able but not yet gated**. Spec 013-03 grounded the **control** (`rig/config-integrity.js`)
and confirmed the **threat live**: a compromised alloy chamber can re-point its **datastream** (alloy's
`configId`) to an **attacker's Adobe tenant on the same allowed host** (`adobedc.demdex.net`) — real
Edge accepts it (013-03 AC1: honest/attacker HTTP 200, garbage 400), so the user's identity/analytics
flows to the attacker while every **host** allow-list check passes (the tenant rides *outside* the
host/path the seal keys on). This spec wires that control into that seam: the dispatch **pins the
outbound datastream to the host-set value** and **fails closed** on any deviation.

**The control (013-03, grounded).** Two paired postures:
- **OVERRIDE (correct-and-send)** — `pinnedDispatchUrl`: the seam **re-derives** the dispatch URL with
  exactly the host-pinned `configId`, discarding whatever the chamber supplied. **Evasion-proof** —
  unlike a parse-and-compare, it never trusts the chamber's value, so parameter pollution
  (`?configId=<honest>&configId=<attacker>`) / encoding cannot slip past.
- **HOLD-AND-ALERT (detect-and-surface)** — `checkConfigIntegrity`: **fails closed** — an absent,
  duplicated (pollution), or mismatched `configId` is a deviation, surfaced through the diagnostics
  seam (009-02) so the re-route attempt is **observed**, not silent.

**Scope — the wrapped-SDK datastream, not GA4.** Config-integrity is specifically the wrapped-SDK
(alloy) `configId` re-routing 013-03 demonstrated. GA4's endpoints are **host-config** (not
chamber-re-pointable), and GA4's fire-and-forget egress + the synchronous unload fast path are a
separate matter. So this enforcement binds only to the **async `caps.egress.dispatch`** seam — which
means it **side-steps the synchronous-gating sub-problem** spec 014 flagged (the unload path is
GA4-only; there is no wrapped-SDK egress on it to gate).

**Not in scope:** the endpoint-**ceiling** (host-owned endpoint allow-list — that's the separate
endpoint-ceiling enforcement spec) and **purpose-vector consent** (ADR-0007). This spec is *only*
config-integrity: the datastream pin. It is the **narrowest** first bite — one control, one seam, one
threat — deliberately, so the seal's enforcement machinery is proven small before the broader teeth.

## Assumptions

<!-- Grounded 2026-08-30 by reading rig/config-integrity.js (013-03), core/wrapped-sdk-host.js (014-01),
     connectors/alloy/connector.js, ADR-0006, and the 013-03 slice; risk-gated. -->

- **The dispatch seam exists + is gate-able (014-01, ADR-0010).** `core/wrapped-sdk-host.js`'s
  `dispatchInterceptedFetch` calls `caps.egress.dispatch(req)` — the single chokepoint; the gate lands
  at the orchestrator's implementation of `dispatch`. Grounded (`core/wrapped-sdk-host.js`; ADR-0010
  "gate-able, not yet gated").
- **The control is demonstrated + the threat confirmed live (013-03).** `checkConfigIntegrity` +
  `pinnedDispatchUrl` are proven (7 creds-free tests, incl. pollution + absent + override); AC1
  confirmed real Edge routes by `configId` on the shared host. This spec **wires** the demonstrated
  control into core, it does not re-litigate it. Grounded (`rig/config-integrity.js`; 013-03 DONE).
- **The host pin is orchestrator-owned + chamber-immutable.** The pinned datastream is the connector's
  **host-set** `config.datastreamId` (passed to `createWrappedSdkHost` / the connector factory by the
  orchestrator, not reachable by chamber code post-boot). 013-03 established host-owned-config is
  necessary-but-not-sufficient (a compromised chamber owns the alloy instance) — which is exactly why
  the **seam-side** override is the enforceable control, not boot-time ownership alone. Grounded
  (013-03 AC3; `connectors/alloy/connector.js` config path).
- **`configId` is the tenant-routing key on the wire (013-03, verified vs ADR-0004/0006).** The seal
  keys on host/path; the datastream rides as the `configId` query param, *outside* that key — so the
  host allow-list is tenant-blind and the pin must be at the `configId`. Grounded (013-03 frame-critique).
- **An ADR formalizes the control** — the config-integrity requirement 013-03 filed is **not yet in
  ADR-0006** (its endpoint ceiling is tenant-blind). This spec authors the config-integrity ADR
  (seam-side override + fail-closed) as its first step, so the decision is citable + the enforcement
  implements a recorded control.

## Decomposition

SPIDR = **Rules (R)** — the work is a gating rule (config-integrity) enforced at an existing seam;
the mechanism (014 dispatch) + the control (013-03) both exist, so this is neither a Spike nor a new
Path/Interface/Data. Split **simple-rule-first**: the *enforcement* (the seam corrects the egress —
the security value) before the *observability* (the deviation is surfaced — the operator value). Each
slice binds the rule at the real `core/` seam end-to-end (a re-pointed chamber's egress → the seam),
so neither is horizontal.

- **015-01 `[R]` override enforcement at the dispatch seam** — wire the 013-03 control into
  `core/wrapped-sdk-host.js`'s `caps.egress.dispatch` path: before the real fetch, **re-derive the
  outbound `configId` to the host-pinned datastream** (`pinnedDispatchUrl`) and **fail closed** on
  absent/duplicate (`checkConfigIntegrity`). E2E: a re-pointed core-hosted chamber's interact egresses
  to the **host** tenant (overridden), not the attacker's — the seal bites. + the config-integrity ADR.
- **015-02 `[R]` hold-and-alert observability** — surface every config-integrity deviation (override
  applied / held) through the **009-02 diagnostics seam**, so a re-route attempt is **observed**, not
  silently corrected — the operator-visible half (OQ7-adjacent inspector food). E2E: a re-pointed
  chamber produces a diagnostic record naming the deviation, alongside the corrected egress.

## Slices

1. [015-01 — override enforcement at the dispatch seam](slice-01-override-enforcement.md)
2. [015-02 — hold-and-alert observability](slice-02-hold-and-alert.md)
