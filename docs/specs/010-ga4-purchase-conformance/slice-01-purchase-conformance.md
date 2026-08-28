---
status: DRAFT
dependencies: []
last_verified:
arch_review: true
frame_review: true
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

**DoD:**
- [ ] All ACs pass; `cd contracts && npm run validate` green; `npm test` green.
- [ ] The negative control is shown to fail-closed (schema rejects the malformed
      purchase); relaxing the schema makes the control wrongly pass
      (mutation-tested; restore via Edit, never `git checkout --`).
- [ ] Reviewed by `reviewer` subagent (compliance + craft + arch).
- [ ] `contracts/ga4-mp.md` updated with the `items[]` shape (contract doc).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.

**Anti-horizontal-phasing check:** After this slice, the `ga4_mp_conformance`
oracle validates a purchase — the key conversion event is under the same
deterministic contract gate as every other event, closing the coverage gap the
008 review surfaced.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation._
