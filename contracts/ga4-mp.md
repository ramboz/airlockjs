# Contract: GA4 Measurement Protocol (web data stream)

Pinned drive-order step 5. Contract surface 1 (architecture.md) — the **external,
versioned, machine-validatable** contract and the MVP1 servo oracle. A break
against this contract is a tooling/agent failure, not spec ambiguity.

Request body schema: [ga4-mp-request.schema.json](ga4-mp-request.schema.json).
Golden fixtures: [fixtures/](fixtures/). Validator: `npm run validate`.

## Endpoint & auth

| | Value |
|---|---|
| Method | `POST`, `Content-Type: application/json` |
| Production | `https://www.google-analytics.com/mp/collect` |
| EU / regional | `https://region1.google-analytics.com/mp/collect` |
| Validation | `https://www.google-analytics.com/debug/mp/collect` (identical query+body) |
| Query params (required) | `measurement_id` (`G-XXXXXXXXXX`), `api_secret` |

Credentials are **not** in the body; they are query params. The debug endpoint
does **not** verify them.

## The `ga4_mp_conformance` oracle — two parts (R-002)

`/debug/mp/collect` alone is a **weak** pass: an empty `validationMessages` array
does not mean the payload is correct. It does not verify credentials and it does
not catch unknown/typo'd (but well-formed) event names, because GA4 accepts
arbitrary custom event names by design. So the oracle is two complementary checks:

1. **Hermetic (authoritative, no network).** The built payload MUST (a) validate
   against `ga4-mp-request.schema.json` (structure, name/param rules, reserved
   names, 25/25 caps, value lengths) AND (b) match the pinned **golden fixture**
   for the event under test (exact event `name` + expected params). The golden
   fixture is what catches a typo'd event name — the schema and the debug
   endpoint cannot. This is `contracts/validate.mjs`; it is deterministic and
   CI-safe.
2. **Live (complementary, non-blocking).** POST the same payload to
   `/debug/mp/collect` and gate on the **presence** of `validationMessages`
   entries (a non-empty array is a real defect). Treat absence as "no structural
   error found," not as proof of conformance. Keep this check non-blocking or
   cached so CI never depends on the third-party call.

`validationMessages[]` = `{ fieldPath, description, validationCode }`.
`validationCode` ∈ `VALUE_INVALID`, `VALUE_REQUIRED`, `NAME_INVALID`,
`NAME_RESERVED`, `VALUE_OUT_OF_BOUNDS`, `EXCEEDED_MAX_ENTITIES`, `NAME_DUPLICATED`.

## `client_id` & `session_id` without gtag

- **`client_id`** (required, body): any stable unique string. For continuity with
  on-page GA, reuse the `_ga` cookie's client_id (its last two dotted segments,
  `<random>.<unix-seconds>`); otherwise generate + persist one in a first-party
  cookie via the mediated cookie capability ([capability.d.ts](capability.d.ts)).
- **`session_id`** + **`engagement_time_msec`** (both in each event's `params`)
  are required for events to appear in standard reports and be attributed to a
  session. `session_id` comes from the `_ga_<stream>` session cookie.
- **Contract stance:** `client_id` and `session_id` are **opaque strings**. The
  `_ga` / `_ga_<stream>` cookie grammar is not part of Google's schema and has
  already changed (GS1→GS2), so it is NOT encoded in the JSON Schema; the runtime
  parses it defensively.

## Ecommerce `items[]` (spec 010-01)

`purchase` (and any other ecommerce event) carries a `params.items` array. The
schema models a **minimal** item shape — enough to validate a conformant
purchase and reject an obviously-malformed one, not the full GA4 ecommerce
catalog (`item_brand`, `item_category2..5`, `item_variant`, etc. are all
accepted permissively but not individually typed):

| Field | Rule |
|---|---|
| `items` | Non-empty array (`minItems: 1`); a scalar or `[]` is rejected. |
| each item | Object; must have **at least one of** `item_id` / `item_name`. |
| `item_id` / `item_name` | `string`, non-empty, when present. |
| `price` / `quantity` | `number`, when present. |
| other item fields | Permissive: `string \| number \| boolean`. |

**Deliberately stricter than `/debug/mp/collect`.** The live debug endpoint is
lenient — it may not flag `items: []` or an item missing both `item_id` and
`item_name` in its `validationMessages`. The hermetic schema (this file's half of
the oracle) enforces the stricter **item-shape** rules anyway: a non-empty
`items[]`, each element an object with ≥1 of `item_id`/`item_name` and
numeric `price`/`quantity`. Per the "hermetic half is authoritative" stance
above, this is by design, not a false gate.

**Two-layer split (be precise about who enforces what).** The *schema* pins the
`items[]` **shape** only. The *connector* (`connectors/ga4/map.js`
`validatePurchase`) enforces the purchase **business rules** at map time —
required `transaction_id`/`currency` and a non-negative `value` — which the
schema does **not** (a purchase body missing `transaction_id` or with a negative
`value` still validates against the schema; `mapToMp` rejects it first). Schema =
generic MP item shape; connector = purchase semantics.

Golden: [fixtures/ga4-mp-purchase.golden.json](fixtures/ga4-mp-purchase.golden.json).

## Key limits (encoded in the schema)

| Limit | Value |
|---|---|
| Events per request | ≤ 25 |
| Params per event | ≤ 25 |
| Event name | ≤ 40 chars, `^[A-Za-z][A-Za-z0-9_]*$`, not reserved |
| Param name | ≤ 40 chars, no `_`/`firebase_`/`ga_`/`google_`/`gtag.` prefix |
| Param value (string) | ≤ 100 chars (standard) / 500 (360) |
| User properties | ≤ 25; name ≤ 24, value ≤ 36 |
| Total POST body | < 130 kB |

## Provenance

Sourced from Google's official GA4 MP docs (2026-08, via [R-002](../docs/research/R-002-ga4-debug-endpoint-oracle.md)'s
follow-up verification):
- reference: https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag
- sending-events: https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events?client_type=gtag
- validating-events: https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events?client_type=gtag
- user-properties: https://developers.google.com/analytics/devguides/collection/protocol/ga4/user-properties?client_type=gtag
- use-cases (session attribution): https://developers.google.com/analytics/devguides/collection/protocol/ga4/use-cases
- ecommerce-items (`items[]` shape, spec 010-01): https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference/events?client_type=gtag#ecommerce

The `_ga` cookie grammar (client_id/session_id extraction) is community-derived
(not Google's schema) and deliberately excluded from the pinned contract.
