---
status: DONE
skill:
use_cases: [UC-2]
servo_driven: true
---

# Spec 008: GA4 ecommerce `purchase` conversion event

> **Servo-driven feature (not the jig review ceremony).** This spec is the goal
> for a `/servo:agent-loop` run: the executable oracle target is
> [test/ga4-purchase.test.js](../../../test/ga4-purchase.test.js), and the loop's
> runner implements the connector change until `oracle.sh` (at `THRESHOLD=1.0`)
> is green. Reserved 2026-08-27.

## Overview

The GA4 connector's `mapToMp` ([connectors/ga4/map.js](../../../connectors/ga4/map.js))
is a generic passthrough — it already *maps* a `purchase` event, but does not
**validate** it. A `purchase` is GA4's key **conversion** event for a commerce
demo site, and the GA4 Measurement-Protocol ecommerce contract requires it to
carry `transaction_id`, `currency`, `value`, and a non-empty `items[]`. Silently
emitting a malformed purchase produces a beacon GA4 drops or mis-attributes.

This feature adds **purchase-scoped validation** to the connector: a `purchase`
event missing any required field is rejected with a clear error naming the
field, while non-purchase events are untouched.

## Acceptance Criteria (the oracle target)

These are asserted by `test/ga4-purchase.test.js` (in the default vitest suite,
so `score_vitest` gates on them at `THRESHOLD=1.0`):

1. **A valid purchase maps to an MP-conformant body** — event name `purchase`,
   params carry `transaction_id` / `currency` / `value` / `items`, plus the
   existing `session_id` + `engagement_time_msec` enrichment (regression guard).
2. **`mapToMp` throws on a purchase missing `transaction_id`** — the error
   message names `transaction_id`.
3. **… missing `currency`** — error names `currency`.
4. **… missing `value`** — error names `value`.
5. **… missing or empty `items[]`** — error names `items`.
6. **Validation is purchase-scoped** — a non-purchase event (`page_view`) maps
   generically and is NOT subject to purchase validation.

## Non-goals

- No new event types beyond `purchase`.
- No enrichment/derivation (e.g. computing `value` from items) — reject, don't
  repair. (Design-review note: negative `value` is rejected — that's a `refund`,
  a separate GA4 event; zero is allowed.)
- **Not in scope (tracked as follow-ups, see [refinement-todo](../../refinement-todo.md)):**
  the feature is expressed as **unit behavior** on `mapToMp`, and does *not*
  extend the hermetic `ga4_mp_conformance` schema/golden coverage to purchase.
  ⚠️ **Correction (008 design review):** an earlier draft claimed "the generic
  mapping already conforms / no schema-golden changes required" — that is
  **false**. The pinned [ga4-mp-request.schema.json](../../../contracts/ga4-mp-request.schema.json)
  restricts `params` values to `string|number|boolean`, so an ecommerce
  `items[]` array-of-objects is **rejected by the contract**, and there is no
  purchase golden fixture — so a *valid* purchase body would fail its own pinned
  schema, and the conformance oracle does **not** cover purchase. Closing that
  (an `items` schema shape + a `ga4-mp-purchase.golden.json`) is a follow-up.

## Slices

- [008-01 — purchase-conversion validation in the GA4 connector](slice-01-purchase-validation.md)
