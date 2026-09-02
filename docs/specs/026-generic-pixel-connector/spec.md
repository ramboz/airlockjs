---
status: DRAFT
skill: jig:spec-workflow
use_cases: [UC-2]
---

# Spec 026: generic pixel connector (the most-common-tags adoption thread)

> **Reserved + lightly framed** (maintainer, 2026-09-02) as the parallel "focus on the most common tags first
> / easy migration" thread. Detail its slices when picked up. This is the **governance-side breadth leverage**
> from [R-007](../../research/R-007-real-prod-stack-breadth.md) — not the performance/worker-dom thread (025).

## Overview

Most of the **most common** martech tags are **analytics + pixels** (Meta/Facebook Pixel, Google Ads /
Floodlight / CM360, LinkedIn Insight, Bing UET, Reddit, TikTok, Outbrain, the OpenAI pixel, …) — **data +
network** tags that read page/event state and fire a beacon. Their natural airlock home is the **proven
wire-protocol connector archetype** (GA4 + alloy are the shipped exemplars), **not** worker-dom (they are not
DOM-heavy). A **single, config-driven *generic pixel* connector** — where a pixel vendor is expressed as
*{ endpoint, param/payload mapping, identity + consent surface }* — can bring **~10 vendors** (R-007's biggest
single leverage win) under airlock's seal with **one** connector + N vendor configs, instead of N bespoke
connectors.

**Why this is the "most common tags first" move (maintainer, 2026-09-02):** the common tags are
connector-shaped, so the highest-adoption-leverage next step is this archetype — the *proven* path (no unproven
mirror bet), an easy migration (a config, not a rewrite), and it composes with the existing GA4/alloy/RUM
connectors as another "option for adoption." worker-dom (025) is the *long-tail DOM-heavy* path; this is the
*common-tag* path.

## Current state (grounded)

- [R-007](../../research/R-007-real-prod-stack-breadth.md) classified ~10 of a real 21-vendor prod stack as
  **pixels** — "a generic pixel connector archetype (the big leverage win, ~10 vendors)."
- The connector machinery exists + is proven: `core/connector-host.js`, the `ConnectorManifest`
  (ADR-0006/0007), the seal (endpoint-ceiling + consent + payload governance). GA4
  (`connectors/ga4/connector.js`) is the wire-protocol exemplar to generalise from.
- **Archetype grounded (2026-09-02 recon + frame-critique correction).** A wire-protocol connector is
  `handle(event) → EgressRequest[]`, hosted worker-side by `core/connector-host.js`. The seal's **governance
  verdicts** — consent gate (`core/airlock.js:163`), endpoint ceiling (`:194`), payload governance (`:73-85`) —
  are **method- and connector-agnostic and ride for free**. **BUT** (the frame-critique catch, verified in
  source) the *dispatch* and *connector-selection* are **GA4-shaped, not free**: dispatch is POST-hardcoded
  (`airlock.js:201` / `:363` ignore `EgressRequest.method`, though the contract defines it at
  `connector.d.ts:63`; dispatch is explicitly **OQ10**, `:21-24`), and the connector factory + worker URL are
  hardcoded to GA4 (`chamber.worker.js:46,62`; `airlock.js:148`). So a **GET** pixel needs two **bounded**
  core generalizations (026-01 builds them, resolving OQ10 for GET) — the "zero core changes" premise held only
  for GA4's own POST/JSON shape.
- **Of the config triple, endpoint + consent are already config-shaped, but the param/payload map is net-new.**
  GA4 takes `endpoints` as config and declares consent via a `purposes.egress` array + a matching
  `egressPurposes` to `createAirlock`. But `mapToMp`/`mapToRum` are **bespoke per-connector code** — nothing
  today reads a declarative mapping table. **That interpreter is 026's core deliverable** (the unproven-generality
  bet), not a reuse of existing machinery.

## Assumptions

- **The param/payload-map interpreter can express a real vendor's event→wire transform as *data* (not code)** —
  the central unproven-generality bet. R-007 asserts the ~10-vendor population; 026-01 grounds the *interpreter*
  on one real vendor, 026-02 tests the *generality* across 2–3. **Risk (frame-critique target):** a vendor needs
  a transform (hashing, conditional/derived fields, nested structures) the declarative map can't express → a
  bespoke-code escape hatch, eroding the "one connector + N configs" win. The endpoint + consent surfaces are
  **grounded** as already config-shaped (recon); only the map is the bet.
- **The GET-query-string wire shape is governed because payload governance runs input-side, BEFORE the chamber.**
  The common tracking pixel is a 1×1 image GET (Meta `/tr`, LinkedIn, Bing UET), not a POST body; `governParams`
  strips denylisted PII from `event.params` before postMessage (ADR-0019), so the connector serializes
  *already-governed* params into the query string. **Load-bearing condition (an AC, not a free lunch):** the
  connector must put **only governed `event.params`** into the URL and inject **no un-governed identity from
  `ctx`** — else PII re-enters via the query string (violating "no PII in URL params"). Hashed-identity /
  advanced-matching fields (which *do* handle PII) are therefore **deferred to 026-03** with their own governance.
- **Consent wiring stays two-places-must-agree (grounded); 026 does NOT build the MVP3 grant resolver.** The
  manifest's `purposes.egress` is *declared, not enforced*; real enforcement is the caller's `egressPurposes` to
  `createAirlock`, hand-wired in the adapter. A vendor config declares its consent class once, but until the
  MVP3 grant resolver derives `egressPurposes` from the manifest, the adapter still wires it per vendor. 026-01
  **accepts** this two-places wiring (deferring the loop-close to MVP3) rather than building enforcement plumbing
  — aligned with "focus on the most common tags / offer adoption options," not "build the seal's grant resolver."

## Decomposition

SPIDR — **Path → Data → Rules.** The generic connector + its **declarative-map interpreter** is genuinely
novel machinery (nothing reads a mapping table today — recon), so it's proven first on **one** vendor (Path),
then generalised **across** vendors (Data), then the config contract + identity surface pinned (Rules). Not a
spike: the mechanism (wire-protocol seam + seal) is already proven by GA4 — this builds breadth on it.

- **026-01 (Path — the archetype proof):** one real vendor pixel — **Meta Pixel**, the `facebook.com/tr`
  image-GET wire form — as a **declarative config** against a new `createPixelConnector(config)` (the generic,
  vendor-neutral connector whose `handle` interprets a declarative endpoint + event-name + param map, replacing
  bespoke `mapToX` code), **dispatched as a real GET and governed end-to-end**. Getting there builds the two
  **bounded** core seams the archetype needs (frame-critique-mandated): a **connector-selection seam** (a
  non-GA4 connector reaches a chamber) + **method-aware dispatch** (honor `EgressRequest.method` → GET),
  resolving OQ10 for GET. The seal's governance **verdicts** ride unchanged (GA4 regression-tested); the "zero
  core changes" claim is **withdrawn**. Identity is **out of scope** (no `_fbp`/`fbc`/advanced-matching → a
  de-identified but real, dispatchable beacon; identity → follow-ups). Proves the interpreter + the runtime
  generalization on one shippable vendor.
- **026-02 (Data — the archetype generalises):** add 2 more real vendors as configs (e.g. LinkedIn Insight +
  Bing UET, or Google Ads/Floodlight) — **same connector, no per-vendor code** — proving one archetype covers N.
  Include one **POST-body** vendor to prove both wire shapes. Surfaces what actually varies vendor-to-vendor
  (→ the config contract).
- **026-03 (Rules — the config contract + identity surface):** pin the `PixelVendorConfig` type + handle
  **advanced-matching / hashed-identity** fields (in-chamber hashing, per-field consent class) — the "identity"
  third of the config triple, deferred from 026-01.

## Slices

- [026-01 — Meta Pixel through the generic connector, governed (the archetype proof)](slice-01-meta-pixel.md)
- _026-02 (tbd) — 2–3 more vendors as configs; the archetype generalises across vendors + wire shapes._
- _026-03 (tbd) — the config contract + advanced-matching / identity surface._
