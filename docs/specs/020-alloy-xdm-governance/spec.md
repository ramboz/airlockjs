---
status: IN_PROGRESS
skill:
use_cases: [UC-1, UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 020: alloy XDM governance — finish the wrapped-SDK's payload + consent enforcement (or prove it must be read-minimization)

## Overview

**MVP4's alloy-completion** (release [mvp4.md](../../docs/releases/mvp4.md), committed): turn "alloy isolated"
into "alloy **governed**." MVP3 gave alloy endpoint-ceiling + config-integrity + confinement but **deliberately
split its payload + consent governance** as probe-gated — the vendor (`@adobe/alloy`) builds the **XDM body
inside the chamber**, so a strip / consent-inject at the seal is fragile and might break it
([ADR-0012](../../docs/decisions/adr-0012-payload-governance.md) Split; ADR-0007 alloy residual). This spec
settles that.

**The governing question is a feasibility unknown, so the S(pike) axis fires first (legitimately).** We
cannot pick the approach — *strip-at-seal* vs *read-minimization fallback* — until we know whether alloy's
vendor-built XDM request body can be governed without breaking alloy's structure or Adobe Edge's acceptance.
So **slice 020-01 is a time-boxed feasibility probe**; its outcome gates the downstream slices (implement the
governance, or record read-minimization as the honest alloy defense).

**The seam is grounded.** alloy's egress is the intercepted `fetch` to the Edge `interact` endpoint, dispatched
on the main thread by [`core/wrapped-sdk-host.js`](../../core/wrapped-sdk-host.js)'s `dispatchInterceptedFetch`
— the **same seam** where the endpoint-ceiling + config-integrity already bind (before `caps.egress.dispatch`).
The request `body` is the XDM JSON (`{ events: [{ xdm: {…} }], … }`), and
[`connectors/alloy/xdm-mint.js`](../../connectors/alloy/xdm-mint.js) **already parses it** (`parsed.xdm`,
`events.map(e => e.xdm)`, `xdm.identityMap.ECID`). So parse→inspect at the seam is proven; the open question is
whether **govern** (strip sensitive fields / inject-enforce XDM consent) at that seam is safe.

**What "governed" means for alloy (two SEPARATE halves — the 020-01 frame-critique + the maintainer's consent
correction reframed both from the original "strip + inject at the seam" premise):**
- **Payload — already read-minimized by construction.** Unlike GA4's `mapToMp` (which spreads `params`
  verbatim), alloy's egress `xdm` is built by `toXdm` — a **2-field allowlist** (`eventType` +
  `web.webPageDetails`) — with `context:[]` disabling alloy's ambient auto-collection. So there is little
  sensitive data in the airlock-built body to strip; this half is mostly **confirming** that minimization + an
  **optional thin defense-in-depth** seam-strip if any residual vendor field warrants it — NOT the fragile
  "strip a rich vendor body" the ADR-0012 Split feared.
- **Consent — the `setConsent` command, not a body field.** alloy consent is the client `setConsent` command
  (`configure → setConsent → sendEvent`), NOT an XDM body injection. airlock maps the ADR-0007 vector →
  Adobe's 2.0 consent shape → drives `setConsent` in the **chamber's alloy-boot glue** (the vector crosses in
  at `init`) — **delegate-and-send**, parallel to GA4's MP-consent point ①. The vendor-idiomatic, non-fragile
  path (its supported API), so consent — not payload — is the genuine open work.

**Honest fallback (named up front).** If the probe finds strip/inject at the seal fragile (breaks XDM
validity or Edge acceptance), alloy's governed defense is **read-minimization** (ADR-0003 — govern what
crosses INTO the chamber) **+ the confinement/config-integrity/endpoint-ceiling already shipped**. Note the
gap this leaves: alloy's **ambient in-chamber collection** (012-04 Axis-2 — device/web context the vendor
gathers itself, not from `AirlockEvent`) is unreachable by input read-minimization; that stays the
read-minimization horizon, not this spec's.

## Assumptions

<!-- Grounded 2026-08-31 by reading core/wrapped-sdk-host.js (dispatchInterceptedFetch, the ceiling/config-integrity
     bind points), connectors/alloy/connector.js (toXdm, sendEvent xdm), connectors/alloy/xdm-mint.js
     (the body-parse precedent), ADR-0012/0007, spec 012-04; risk-gated. -->

- **The governance seam is `dispatchInterceptedFetch` in `core/wrapped-sdk-host.js`**, where the XDM request
  `body` (JSON) is available on the main thread before `caps.egress.dispatch`, and where the endpoint-ceiling
  + config-integrity already bind. **Grounded** (read).
- **The XDM body is parseable JSON and airlock already parses it** (`xdm-mint.js` reads `parsed.xdm` /
  `events[].xdm` / `identityMap.ECID`). So parse→govern→re-serialize is mechanically available. **Grounded.**
- **Whether stripping / consent-injecting the XDM body breaks alloy or Edge is UNKNOWN** — the probe's core
  question. XDM is Edge-schema-validated; stripping a custom/PII field is likely safe, stripping a required
  field is not; injecting `xdm.consents` may conflict with the SDK's own consent state. **Assumption, probed
  in 020-01.**
- **Adobe's XDM consent shape is external domain knowledge** (the `xdm.consents` / Adobe Consent standard) —
  to be verified against current Adobe docs during the probe, not asserted here. **Listed, not asserted.**
- **A live-Edge acceptance check is creds-gated** (mirrors spec 013's live-Alloy legs) — the hermetic design
  feasibility is investigable against the alloy stubs + the known XDM shape; the "real Edge accepts a governed
  XDM body" leg needs the maintainer's test datastream. **Grounded** (013 precedent).

## Decomposition

SPIDR = **Spike first (legitimately), then Rules.** The strip-at-seal feasibility is the unknown that gates
the whole approach — none of Path/Interface/Data/Rules can be picked until 020-01 settles *strip-at-seal vs
read-minimization*. The spike is **nested in this real spec** (never a standalone), and articulates its
downstream change up front (below). After it:
- **If feasible →** Rules slices implement the alloy payload strip + consent enforcement at the seam (binding
  the existing `governPayload` + the ADR-0007 consent vector to the XDM body).
- **If fragile →** a slice records read-minimization + the honest boundary (and, if it rises to a decision, an
  ADR superseding ADR-0012's alloy-Split disposition).

- **020-01 `[S]` feasibility probe** — can alloy's vendor-built XDM body be governed (strip sensitive fields +
  enforce/inject XDM consent) at the `dispatchInterceptedFetch` seam without breaking alloy/Edge? Time-boxed;
  outcome gates 020-02+.
- **020-02+ `[R]` (gated on 020-01's outcome)** — implement the governance (strip + consent at the seam) OR
  record read-minimization as the alloy defense. Drafted after the spike concludes.

## Slices

1. [020-01 — alloy XDM-governance feasibility probe](slice-01-feasibility-probe.md) `kind: spike` — **DONE.**
   Outcome: **both halves feasible via idiomatic paths** (payload already minimal + Edge-safe strip; consent
   via the `setConsent` command + a seam-side drop). Unblocks 020-02.
2. [020-02 — implement alloy consent enforcement (seam drop + setConsent) + optional payload strip](slice-02-implement.md)
   — the implementation the probe unblocked.
