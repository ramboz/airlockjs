---
status: DRAFT
dependencies: [060-02, 060-03, 060-05, 060-06]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-10 - Correlate browser and server events

**Goal:** An adopter keeps browser Pixel collection interoperable with an
existing server event channel without duplicate-count assumptions or replacing
the browser path with server sends.

**DoR:**
- [ ] Event/routing/continuity/identity journeys 02/03/05/06 are available.
- [ ] Owner explicitly supplies an existing controlled Conversions API (CAPI)
      counterpart, private data/source handles and separately bounded test/
      receipt authority. No credential discovery or full CAPI project.
- [ ] Native event-ID invocation/wire semantics and applicable source-order/
      window behavior are pinned; outcome observations and privacy criteria exist.

**Acceptance Criteria:**

1. Browser `eventID` reaches native-equivalent `eid`/other observed encoding
   through actual chamber and host. Compare track fourth-argument and
   trackSingle fifth-argument options as documented; custom-event/single-custom
   options require their own observed native semantics, not argument guessing.
2. Matching and mismatched event name/ID/Pixel relationships to the existing
   CAPI `event_name`/`event_id` are preserved. Same-input first-party/identity
   values remain consistent across channels without changing native hash rules.
3. Correlated actual browser/server dispatch, response and available backend
   deduplication/merging evidence are recorded separately, with browser-first,
   server-first and mismatched controls. The documented 48-hour window and any
   delayed case require their own finite plan; simulated clocks cannot stand
   in for real backend-window evidence.
4. Repeated browser-only and server-only sends, with and without explicit IDs,
   retain native source-specific behavior. Do not suppress two browser calls
   because cross-source deduplication exists. Distinguish transport retries and
   automatic/manual duplication from one logical event.
5. Where applicable, native `fbp`/`external_id` fallback and ordering semantics
   are observed using authorized values; no fallback becomes a substitute for
   missing browser ID/path behavior or matching efficacy.
6. Alter target/name/ID, duplicate a conversion, remove the browser send,
   change an identity relationship and withhold a receipt. Each control fails
   or becomes inconclusive under C1-C9; presence-only/redaction equality and
   a successful server response cannot qualify browser parity.
7. The operator sees request/event correlation, actual counts and unavailable
   deduplication evidence without public identifiers. The replacement remains
   fully browser-capable with no new ambient egress or CAPI credentials in page
   code; later lifecycle integration must preserve these relationships.

**DoD:**
- [ ] Native browser ID and source-order/duplicate controls pass with exact
      evidence layers; delayed/unavailable cases remain honestly blocked.
- [ ] Targeted browser/chamber/contract and existing server interoperability
      regressions plus applicable lint pass.
- [ ] Independent compliance, craft, architecture and reconciliation reviews pass.
- [ ] Operator instructions distinguish CAPI complement, receipt and deduplication.

**Anti-horizontal-phasing check:** The adopter runs a real browser-plus-existing-
server event journey and diagnoses its actual correlation rather than a key mapper.

## Experimental local construction - 2026-10-29

The documented `track` fourth-argument and `trackSingle` fifth-argument shapes
are available behind the separate `experimentalEventIds` and existing
`experimentalPageViewData` opt-ins. The local prototype snapshots a bounded
caller-supplied `eventID`, maps it to an `eid` query field in the chamber and
routes it through the real serialized first-party Node worker and governed
loopback receiver. Tests cover broadcast, targeting, mutation, malformed
options, consent holds and repeated same-ID browser-only calls; no duplicates
are suppressed.

With `experimentalEvents` enabled, the existing event-ID opt-in also accepts
the fourth argument of `trackCustom`. Meta's Magento plugin sets
[`trackCustom` and `Purchase` in its browser payload](https://github.com/meta/meta-for-magento2/blob/5ab5527cdc72ec248b1385f8aa4c80baf81109ba/app/code/Meta/Conversion/view/frontend/templates/pixel/purchase.phtml#L22-L40)
and [passes `eventID` to `fbq`](https://github.com/meta/meta-for-magento2/blob/5ab5527cdc72ec248b1385f8aa4c80baf81109ba/app/code/Meta/Conversion/view/frontend/web/js/metaPixelTracker.js#L34-L47).
The local subset snapshots and revalidates that option, emits its assumed
`eid` through the serialized worker and loopback seal, and retains host and
tag consent controls. Tests cover broadcast, standard targeted controls,
mutation, malformed records and no replay. The plugin's complete payload is
not yet supported or qualified. The `trackSingleCustom` option remains
rejected; the source does not establish that form.

The input examples are not native input-to-wire captures. The `eid`
mapping, accepted types/bounds and errors are experimental assumptions, not a
qualified native representation. The local receiver cannot establish vendor
receipt, browser/server matching or deduplication; no CAPI or vendor event was
sent. All DoR, acceptance, live authority and full-compatibility gates remain
open.

## Assumptions

- Unverified: owned source access and a lawful existing server test path can
  provide discriminable deduplication/merging evidence within finite grants.
- Unverified: exact browser/custom-event ID and identity representations can be
  preserved without raw identity egress or changes to the frozen transport seam.

### Close-out (post-DONE)

- [ ] Parent records board/learnings, unresolved windows and access boundaries.

### Deviation log (after reconciliation)

Not implemented; no server project, deduplication or browser exactly-once claim.

### Reconciliation sweep

Pending implementation: ID/cookie/identity mappings, browser-only duplicates,
CAPI interoperability procedure, private receipts and assurance terminology.
