---
status: DRAFT
dependencies: [059-04]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 059-06 - Rich purchase and counting journeys

**Goal:** An adopter reports complete orders and customer classifications while
preserving native cart values, duplicate behavior and feature-specific reporting inputs.

**DoR:**
- [ ] 059-04 is DONE; C1-C3/058 references qualify direct purchase, repeated-order,
      cart, custom-variable and acquisition cases.
- [ ] Parent supplies action value/count/window/attribution settings, eligible
      Merchant Center/feed metadata, custom-variable activation and acquisition
      configuration privately; no account mutation is implied.
- [ ] Resolve direct Ads conversion/purchase and id/item_id schema differences,
      custom serialization and additional current acquisition parameters by evidence.

**Acceptance Criteria:**

1. Page/click conversions and rich purchase inputs preserve native value,
   currency and transaction relationships across reload, back/forward, repeated
   same order, distinct orders, absent order ID and separate labels/tabs.
   Invalid/boundary fixtures remain no-send unless explicitly authorized.
2. Count native attempted requests, retries, response fanout and callbacks
   separately from product counted conversions. Do not introduce local
   deduplication because Google documents server duplicate-order suppression,
   or introduce a generic retry that produces extra native-incompatible events.
3. Cart item IDs/prices/quantities, currency, order discount and relevant
   aw_merchant_id/aw_feed_country/aw_feed_language or source-specific alternatives
   preserve units, arithmetic, array association and feed links. Direct Ads id
   and imported GA4 item_id remain distinct schemas, not interchangeable defaults.
4. Determine native conversion versus purchase request shape and event routing
   for cart data; capture all branches and applicable order linkage. Linked
   Merchant Center matching, optional feed cost-of-goods profit inputs and product
   reporting are recorded as separate evidence, not inferred from an item array.
5. Custom conversion variables preserve current tag strings, escaping, types,
   value association and enabled/paused/activation-needed behavior. A received
   field is not a recorded reporting dimension until independently evidenced.
6. new_customer true/false/omitted and guest/unknown customer inputs preserve
   business truth and native semantics, not fresh-cookie heuristics. Discover
   and cover any additional currently supported acquisition/lifetime/high-value
   extensions; missing documentation is a blocker, not a silent omission.
7. Wrong order/item/price/quantity/currency, duplicate/drop, altered custom
   dimension and flipped customer classification cause failed controls.
   Controlled distinct values must remain distinct; equal redaction sentinels
   cannot manufacture matching orders.
8. Operator results expose per-feature C1 evidence and separate HTTP, product
   cart/count/custom/acquisition reporting and attribution. Complete paths run
   in the real chamber, preserve consent/state and meet C3; no backend service
   or full GA4 implementation is smuggled into the browser replacement.

**DoD:**
- [ ] Each order/count/cart/custom/acquisition scenario has qualified positive
      and witnessed failing evidence; targeted tests and applicable lint pass.
- [ ] Compliance, craft, architecture and reconciliation reviews pass.
- [ ] Feature-specific setup/outcome documentation and exact schemas are pinned.
- [ ] Deviation/reconciliation records preserve all remaining outcome obligations.

**Anti-horizontal-phasing check:** The adopter submits meaningful rich orders
and receives a complete, scoped counting/reporting result, not just item parsing.

## Owner-directed offline experiment - 2026-10-29

The separately gated `experimentalPurchase` option accepts the `purchase`
call and boolean `new_customer` input shown in
[Google's acquisition guidance](https://support.google.com/google-ads/answer/12077475?hl=en).
It exercises true, false and unspecified values through the local worker and
loopback receiver, without inferring classification from identity. Its
`airlock_event` and `airlock_new_customer` fields are invented local test
markers, not Google wire fields. Native routing and encoding, business
classification, cart data, reporting and attribution remain unqualified.
This experiment does not advance this DRAFT slice or its acceptance criteria.

The separately gated `experimentalPurchaseCart` option adds bounded synthetic
item records to that local purchase path. [Google's cart guidance](https://support.google.com/google-ads/answer/14943675?hl=en)
lists direct Ads `items.id`, `price` and `quantity`, but its introductory
note instead names `item_id`; that conflict remains unresolved. The local
subset refuses `item_id` and uses an invented `airlock_items` field. It does
not establish native encoding, arithmetic, feed matching or product outcomes.

## Assumptions

- Unverified: complete current native cart/custom/acquisition behavior can be
  pinned, including source-specific and remotely configured extensions.
- Unverified: permitted owned order/count/product observations can discriminate
  backend effects without fake customers, campaigns or unapproved repeat sends.

### Close-out (post-DONE)

- [ ] Parent checks order/reporting guidance, family coverage and board.

### Deviation log (after reconciliation)

Not implemented; no duplicate-count, cart or acquisition outcome is established.

### Reconciliation sweep

Pending implementation and formal review.
