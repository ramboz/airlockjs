---
status: DRAFT
dependencies: [059-04]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

> **Rescoped 2026-11 by [spec 065](../065-google-ads-parity-inventory/spec.md) (ADR-0061).** Replaced by G5 in spec 065 section 9. History kept; criteria are inputs to the new slice file.

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

## Owner-directed offline experiment - 2026-10-29

The separately gated `experimentalRetailViewItem` accepts a bounded synthetic
subset of the numeric-ID retail `view_item` example in
[Google's dynamic-remarketing guide](https://support.google.com/google-ads/answer/7305793?hl=en).
It snapshots items and optional value through a worker and a single local
receiver without inventing a conversion label. Its local route, marker fields
and limits are hypotheses. Other event shapes, scope and multi-destination
handling, native wire behavior, audience membership, feed matching and
attribution remain unqualified. This does not advance this DRAFT slice.
The separate `experimentalEducationViewItem` opt-in exercises the same guide's
education example with bounded synthetic IDs and an optional location ID. Its
local restrictions and routing are assumptions; it can coexist with the
retail subset but does not establish education feed matching or native behavior.
Separately gated local-deals and real-estate `view_item` subsets exercise the
same guide's string-ID examples. Their restrictions, single local route
and markers are also assumptions; neither qualifies audience or feed outcomes.
The separately gated travel subset adds bounded synthetic origin, destination
and date inputs from that guide. Destination remains event data, not a network
address. Calendar validation, routing and feed-key behavior remain unqualified.
The guide describes total `value` as optional across dynamic remarketing events;
these five subsets now accept it absent or explicitly undefined and preserve
zero. The handling of explicit undefined and the loopback marker remain local
choices, not native wire evidence.
The separate `experimentalViewItemList` gate reuses an enabled vertical's
bounded local schema for the guide's `view_item_list` event. That schema
reuse, the local event marker, routing and fanout remain hypotheses; it
does not qualify the native list journey or audience outcomes.
Separate default-off `view_search_results` and `add_to_cart` gates reuse the
same local input model. Their event markers are distinct, but neither search
behavior, shopping-cart effects nor native event handling is established.
The separately gated unlabeled `purchase` experiment uses the same bounded
model and rejects ambiguity with a labeled purchase. The distinction, marker,
schema reuse and route are local choices; native purchase fanout remains open.
The separately gated flights subset exercises the guide's purchase example
with all four illustrated origin, destination and date fields. Requiring all
four, reusing this schema for other events and applying travel's local date
validation are assumptions, not native validation or flight-feed evidence.

The [Google conversion setup guide](https://developers.google.com/tag-platform/devguides/conversions)
shows a global `allow_ad_personalization_signals: false` set command before
bootstrap to disable remarketing data collection. The separately opt-in
[local suppression experiment](../../../connectors/google-ads/CONVERSION-PROTOTYPE.md#experimental-one-way-remarketing-suppression)
accepts only that one-way, first-command form and suppresses this prototype's
enabled remarketing events without granting consent or replaying held events.
It preserves the separately sealed labeled conversion and purchase paths.
Its narrowed scope and dispositions are local policy, not native request,
audience, privacy-mode or product evidence. This does not advance this DRAFT
slice, its dependencies, or any production gate.

Current host-side correlation revalidates and serializes remarketing items and
constructs expected labeled-purchase query fields when its purchase gate is on.
When the suppression command is active, it also constructs expected conversion
fields. The worker constructs the dispatched request, but this duplicated host
mapping does not satisfy the capture-and-enqueue-only architectural target in
criterion 8.

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
