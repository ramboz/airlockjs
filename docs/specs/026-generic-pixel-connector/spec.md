---
status: DRAFT
skill: jig:spec-workflow
use_cases: []
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

## Assumptions

- **[to ground when picked up]** A pixel's variability across vendors is capturable in a **declarative config**
  (endpoint + a param/payload map + which fields are identity/consent-relevant) — i.e. the ~10 vendors really
  do share one archetype rather than each needing bespoke logic. R-007 asserts this; the first slice grounds it
  by expressing 2–3 real vendors (e.g. Meta Pixel + Google Ads) as configs against the generic connector.
- Each vendor's governance class (consent-gated like marketing analytics? endpoints? identity cookies) is
  declared per config, reusing the GA4/alloy consent + endpoint-ceiling machinery.

## Decomposition

_TBD when picked up — likely **Path**-first: one real vendor pixel (e.g. Meta Pixel) through the generic
connector, governed end-to-end (endpoint-ceiling + consent + payload governance), then **Data** (add vendors
as configs; prove the archetype holds across 2–3), then the config contract._

## Slices

- _026-01 (tbd) — one real vendor pixel through the generic connector, governed (the archetype proof)._
