---
status: DRAFT
dependencies: [059-04]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 059-05 - Audience and dynamic remarketing journeys

**Goal:** A marketing engineer replaces native audience and dynamic-item collection
through a complete browse-to-cart/purchase journey with correct feed relationships.

**DoR:**
- [ ] 059-04 is DONE; C1-C3/058 qualify every required audience and vertical case.
- [ ] Parent supplies eligible owned audience/source settings, appropriate
      business feeds or retail Merchant Center linkage, permitted fixture items
      and separate dispatch/product-observation authority.
- [ ] Pin native default page collection, suppression, mirror/fanout and item
      serialization; unavailable vertical evidence remains blocking, not excluded.

**Acceptance Criteria:**

1. Standard initial-page and explicit-event audience collection preserves
   native URL/custom-parameter context and full request/response branches,
   including viewthrough/rmkt/ccm/user-list behavior when applicable. Do not
   reduce all audience traffic to one page-view endpoint.
2. send_page_view false, personalization signal settings, consent ad_storage/
   ad_personalization, restricted processing and conversion-based customer-list
   choices preserve native suppression versus retained measurement. Disabled
   personalization must not be assumed to mean zero requests.
3. view_search_results, view_item_list, view_item, add_to_cart and purchase
   carry native-equivalent one/multiple item arrays, optional total value and
   event association. Distinct items remain distinct after privacy processing.
   A purchase event is not silently substituted for a labeled conversion.
4. Cover all inventory verticals: retail, education, flights, hotel_rental,
   jobs, local, real_estate, travel and custom. Preserve required id/destination,
   supported origin/location/date fields, google_business_vertical and
   composite feed-key relationships from each pinned native schema.
5. Retail id/item_group_id/display_ads_id matching and applicable business-feed
   keys use feature-specific native evidence. Missing/malformed/encoded items,
   absent optional fields, repeated IDs and date boundaries are discriminated.
   Unsupported aliases/legacy custom parameters require blocking discovery,
   not an invented common commerce serializer.
6. Fresh/returning, cross-page identity, consent changes, blocked cookies,
   multiple destinations and application cart actions use actual worker
   execution and C1/C2. Local no-send examples cannot prove backend audience
   membership or product/feed matching.
7. Dropped item/branch, wrong composite ID/value/vertical, incorrect suppression,
   extra destination, duplicated event and empty-reference controls fail.
   Under separately authorized legitimate product validation, correlate audience/
   feed observations without campaigns/spend being inferred from tag setup.
8. Operator output separates collection equivalence, product receipt/feed
   matching and eventual serving/outcome evidence. Missing eligible resources
   block the corresponding claim; all complete delivered paths meet C3 without
   unrestricted DOM collection, ambient egress or main-thread mapping.

**DoD:**
- [ ] All events and all nine verticals have explicit scenario/evidence rows
      with witnessed controls; targeted tests and applicable lint pass.
- [ ] Compliance, craft, architecture and reconciliation reviews pass.
- [ ] Audience/feed setup and evidence limits are documented without treating
      GA4 import or responsive-ad serving as a prerequisite for every direct tag.
- [ ] Deviation/reconciliation records carry unresolved product outcomes honestly.

**Anti-horizontal-phasing check:** The adopter's browsing and commerce actions
produce the complete governed audience path and an actionable feed-aware result.

## Assumptions

- Unverified: current native item schemas and auxiliary branch behavior can be
  captured for every required vertical and configuration, including legacy aliases.
- Unverified: eligible owned feed/audience resources and permitted product
  observations will exist; field-correct HTTP traffic alone cannot establish them.

### Close-out (post-DONE)

- [ ] Parent checks audience guidance, family coverage and board.

### Deviation log (after reconciliation)

Not implemented; no audience membership, serving or matching outcome verified.

### Reconciliation sweep

Pending implementation and formal review.
