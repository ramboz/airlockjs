---
status: DRAFT
skill:
use_cases: [UC-2]
---

# Spec 010: GA4 `purchase` Measurement-Protocol conformance coverage

> Pulled into MVP1 2026-08-27 ([mvp1.md](../../releases/mvp1.md) Cutline, OQ15).
> Extends the hermetic `ga4_mp_conformance` oracle to the key conversion event.

## Overview

The 008 design review found that the pinned GA4 MP contract **cannot represent a
purchase**: [contracts/ga4-mp-request.schema.json](../../../contracts/ga4-mp-request.schema.json)
restricts each `params` value to `anyOf[string, number, boolean]`, so an
ecommerce `items[]` array-of-objects is **rejected by the contract**, and there
is **no purchase golden fixture**. So `ga4_mp_conformance` — MVP1's strong
servo-unattended oracle — has never validated the `purchase` conversion event a
body produced by `mapToMp` actually looks like.

This spec closes that: extend the schema to model the GA4 ecommerce `items[]`
shape, add a `purchase` golden fixture, and wire it (plus a negative control)
into the validator — so a valid purchase body validates, a malformed one is
rejected, and the conformance oracle covers purchase like every other event.

## Assumptions

- **A1 — the schema is the single pinned MP contract.** `validate.mjs` compiles
  `ga4-mp-request.schema.json` and gates the goldens against it; extending the
  schema is the contract change (a `/jig:contracts` surface). Verified against
  [contracts/validate.mjs](../../../contracts/validate.mjs) +
  [contracts/ga4-mp.md](../../../contracts/ga4-mp.md).
- **A2 — GA4's `items` shape is the reference.** The ecommerce `items[]` element
  carries at least `item_id` and/or `item_name` (GA4 requires one), and
  optionally `price` (number), `quantity` (number), `item_category`, etc. The
  schema models this minimally (not an exhaustive GA4 catalog) — enough to
  validate a conformant purchase and reject an obviously-malformed one.

## Decomposition

Single vertical slice — a contract extension is one coherent unit (schema +
golden + validator wiring); splitting it would leave a schema with no golden or
a golden with no gate. Not a spike (GA4's purchase MP shape is documented).

## Slices

- [010-01 — purchase schema shape + golden + validator coverage](slice-01-purchase-conformance.md)
