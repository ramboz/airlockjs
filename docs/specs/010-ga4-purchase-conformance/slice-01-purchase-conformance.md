---
status: RECONCILED
dependencies: []
last_verified: 2026-08-27
arch_review: true
frame_review: true
claimed_by: claude/airlock-servo-oracle-ci-6b13d9
---

## Slice 010-01 — purchase schema shape + golden + validator coverage

**Goal:** Extend the pinned GA4 MP contract so a `purchase` conversion validates:
model the ecommerce `items[]` shape in the schema, add a `purchase` golden
fixture, and wire it (plus a negative control) into the validator — so
`ga4_mp_conformance` covers purchase like every other event.

**DoR:**
- ✅ [contracts/validate.mjs](../../../contracts/validate.mjs) passes today
  (`cd contracts && npm run validate`).
- ✅ Spec 008 DONE — `mapToMp` produces the purchase body shape this validates.

**Acceptance Criteria:**

1. **The schema models the ecommerce `items[]` shape.** `ga4-mp-request.schema.json`
   is extended so a `params.items` value is a **non-empty array of item objects**
   (each requiring at least `item_id` or `item_name`; `price`/`quantity` numbers
   when present), while other params keep the existing scalar
   (`string|number|boolean`) contract. Observable: a purchase body with a valid
   `items[]` validates; the same body with `items` as a scalar or an item missing
   both `item_id` and `item_name` fails.
2. **A `purchase` golden fixture exists and validates.** A new
   `contracts/fixtures/ga4-mp-purchase.golden.json` — a realistic purchase MP
   body (client_id, one `purchase` event with `transaction_id`/`currency`/`value`
   /`items[]` + `session_id`/`engagement_time_msec`) — validates against the
   schema. It matches what `mapToMp(purchaseEvent, ctx)` actually emits (spec
   008), so the golden is not fiction. Observable: the golden is in the
   validator's `mustPass` set and passes.
3. **A negative control proves the new shape bites.** `validate.mjs` gains a
   `mustFail` control — a purchase body with a malformed `items[]` (e.g. an item
   with neither `item_id` nor `item_name`, or `items` as `[]`/a scalar) — that
   the schema **rejects**. Observable: the negative control is rejected; if it
   were accepted, `validate.mjs` fails.
4. **No regression.** The 4 existing goldens (`page_view`, custom-event,
   `experiment_impression`, `view_block`) and existing negative controls still
   pass/fail as before. Observable: `cd contracts && npm run validate` green;
   `npm test` green.

**Design notes (for arch review):**
- **Minimal `items` model, not a GA4 catalog.** Model enough to validate a
  conformant purchase and reject an obviously-malformed one (A2) — do not
  over-fit the full GA4 ecommerce spec (that is emergent, OQ3).
- **Contract change is a `/jig:contracts` surface.** The schema is the pinned MP
  contract; the boundary-change nudge applies. Record the extension in
  `contracts/ga4-mp.md`.
- **Ground the item-shape rule + note the deliberate strictness (010-01
  frame-critique).** `ga4-mp.md`'s provenance URLs currently cover the MP request
  body, not the GA4 **ecommerce items** reference — add the ecommerce-items
  source URL when extending the schema, so the "≥1 of `item_id`/`item_name`" rule
  and the negative control's strictness are cited, not folk-knowledge. Note
  explicitly that the hermetic schema is intentionally **stricter** than GA4's
  lenient `/debug/mp/collect` endpoint (which may not flag `items:[]` or an
  id-less item) — by design, per `ga4-mp.md`'s "hermetic half is authoritative"
  stance and consistent with `validatePurchase`; it is not a false gate.

**DoD:**
- [x] All ACs pass; `cd contracts && npm run validate` green (20 checks — 5
      mustPass incl. the purchase golden + 5 purchase negative controls); `npm
      test` green (131).
- [x] The 5 negative controls are shown to fail-closed; relaxing the schema
      (dropping the `anyOf` id/name requirement) makes a control wrongly pass
      (mutation-tested), restored via Edit.
- [x] Reviewed by `reviewer` subagent (compliance + craft + arch, all pass; 2
      more negative controls + a doc-parity correction folded).
- [x] `contracts/ga4-mp.md` updated with the `items[]` shape + two-layer split +
      provenance (contract doc).
- [x] Deviation log + reconciliation sweep produced under this slice heading.

**Anti-horizontal-phasing check:** After this slice, the `ga4_mp_conformance`
oracle validates a purchase — the key conversion event is under the same
deterministic contract gate as every other event, closing the coverage gap the
008 review surfaced.

### Deviation log (after reconciliation)

1. **Schema extended (`ga4-mp-request.schema.json`):** `params.properties.items`
   = `minItems:1` array of `$defs/item`; `$defs/item` requires `anyOf[item_id |
   item_name]`, `price`/`quantity` numbers; the scalar `additionalProperties`
   contract is retained for every other param (JSON Schema resolves `properties`
   before `additionalProperties`, so non-`items` params stay scalar). Added a
   real `ga4-mp-purchase.golden.json` matching `mapToMp` output.
2. **Post-review nits folded (craft):** added **two** negative controls — a
   scalar item *element* (`items:["SKU"]`, bites `$defs.item type:object`) and
   `price` as a string (bites `price type:number`) — closing AC1's
   "price/quantity numbers" mutation coverage. Corrected an **overstatement** in
   `ga4-mp.md`: it claimed the schema matches `validatePurchase`'s full rule set;
   the schema enforces only the `items[]` **shape** — reworded to a two-layer
   split (schema = item shape; connector = purchase business rules).
3. **`items` is a named property (compliance note).** It applies the array shape
   to *any* event carrying an `items` param, not only `purchase` — acceptable
   because `items` is GA4-reserved ecommerce semantics.
4. **Accepted minimal-model trade-offs (arch/craft nits, not fixed):** item
   `price`/`quantity` permit negatives; `item_id`/`item_name` have no `maxLength`;
   the item-level string `additionalProperties` isn't capped at 100 like
   params-level. Deliberately minimal (OQ3/emergent), documented in `ga4-mp.md`.
5. **Golden-match half not in `validate.mjs`** (arch note): the validator gates
   schema-validation only; "match the golden fixture exactly" (`ga4-mp.md`) is
   not asserted for *any* golden (pre-existing pattern) — logged so a future
   slice doesn't assume `npm run validate` covers it.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Contract extension; front-door README unaffected. |
| `docs/specs/README.md` | `deferred` | Regenerated at close-out (post-DONE). |
| `docs/product-vision.md` | `no-op` | No product-scope change. |
| `docs/architecture.md` | `no-op` | The GA4 MP contract surface (`:59`) already points at `contracts/`; the `items[]` extension is recorded in `ga4-mp.md`, not a boundary change to architecture.md. |
| `oracle.sh` | `no-op` | Unchanged — but `score_ga4_mp_conformance` (which runs `validate.mjs`) now covers purchase via the new golden + controls; the servo-unattended oracle's coverage widened without touching `oracle.sh`. |
| `contracts/ga4-mp.md` | `updated` | New "Ecommerce `items[]`" section + the two-layer split + the ecommerce-items provenance URL. |
| `.servo/` | `no-op` | Untouched. |
| Primer surfaces | `no-op` | No primer entry for spec 010. |
| `docs/inbox.md` | `no-op` | Nothing to park. |
| `docs/refinement-todo.md` | `updated` | **OQ15 → RESOLVED** (ga4_mp_conformance now covers purchase). |
| `docs/decisions/**` | `no-op` | Follows the pinned-contract convention; no ADR (the extension is within ADR-0005's oracle-design routing). |
| `docs/memory/**` | `no-op` | Nothing durable beyond the deviation log. |
