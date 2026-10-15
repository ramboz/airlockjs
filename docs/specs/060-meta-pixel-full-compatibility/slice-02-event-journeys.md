---
status: DRAFT
dependencies: [060-01]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-02 - Report complete event and commerce data

**Goal:** A marketing engineer reports native-equivalent standard, custom and
commerce events through existing site calls without losing data or changing types.

**DoR:**
- [ ] 060-01 supplies the real replacement journey and qualified references.
- [ ] Pinned event/type/size/error vectors cover the overview's full vocabulary;
      scalar/array content-ID and nested-price disagreements are resolved by
      observations rather than choosing the easiest public example.
- [ ] Parent identifies existing mapper/governance/configuration seams; approved
      private inputs and scenario-specific actual-dispatch grants are available.

**Acceptance Criteria:**

1. For PageView and all seventeen standard events listed in the overview, the
   adopter's `track` inputs reach the real chamber and official endpoint with
   native event names, request counts and event-data relationships. This includes
   every documented per-event property and newly discovered native option.
2. Commerce journeys preserve exact catalog/content IDs, `content_type`,
   `contents` quantities and supported price data, value/currency, counts,
   delivery category and predicted lifetime value. Test scalar/array IDs,
   multiple items, zero/fractions, boolean status and supported Unicode/nesting.
   Do not infer input numbers from string-valued fixture fields.
3. `trackCustom` supports native name/parameter behavior, including the documented
   50-character boundary and custom properties on standard events. URL/property
   inputs used by custom conversions remain intact; no new conversion-specific
   browser command is invented. Backend rule recognition belongs to 060-11.
4. Missing/empty/null/undefined/nonfinite/invalid values, overlong names,
   oversized payloads, reserved keys and mutation after enqueue produce the
   observed native caller/event behavior and explicit operator evidence. No
   success-shaped omission or unreviewed relaxation of payload governance.
5. C1-C9 comparison covers full encoding, duplicate parameters, body/query
   transport choices, auxiliary requests, responses and browser effects.
   Scalar `cd[region]` in the historical capture does not prove native
   value/currency, array/object or conversion serialization.
6. Deliberately alter a monetary value/type, product ID/quantity, custom name,
   target, nested field or request count. Each corresponding control fails;
   stripping all custom data or relying on the synthetic Lead fixture cannot pass.
7. The operator can identify the originating call and field for a native
   difference, denial or capture gap without raw identity or private data in
   public output. Other generic-pixel vendors and frozen push behavior are
   unchanged as demonstrated by later targeted regression evidence.

**DoD:**
- [ ] Every event/property/error vector has passing and feature-removal controls.
- [ ] Targeted end-to-end serialization, contract and other-vendor regression
      tests plus applicable lint pass.
- [ ] Independent compliance, craft, architecture and reconciliation reviews pass.
- [ ] Native/private provenance and the public event-support ledger remain distinct.

**Anti-horizontal-phasing check:** The engineer completes real event/commerce
reporting with native-equivalent output and diagnostics, not just a new encoder.

## Assumptions

- Unverified: native type/coercion/size behavior is discriminable without losing
  the meaningful relationships to policy filtering and existing frozen APIs.
- Unverified: current mapper/configuration seams can support the complete event
  vocabulary without changing unrelated vendors; parent source evidence is needed.

### Close-out (post-DONE)

- [ ] Parent updates board/learnings and adopter vocabulary; retain all unresolved
      scenarios and do not label the full product complete from this slice.

### Deviation log (after reconciliation)

Not implemented; no conversion execution, type proof or review is claimed.

### Reconciliation sweep

Pending implementation: event documentation, support inventory, configuration/
governance, other-vendor behavior and stable contracts require reconciliation.
