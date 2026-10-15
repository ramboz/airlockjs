---
status: DRAFT
dependencies: [060-03, 060-04, 060-05]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-06 - Match explicit identity through account changes

**Goal:** An adopter supplies explicit identity and changes accounts without
double hashing, stale attachment or cross-Pixel identity leakage.

**DoR:**
- [ ] Routing, policy and first/return browser continuity from 03/04/05 exist.
- [ ] Approved synthetic same-input vectors and native evidence establish every
      field's normalization/prehash/invalid behavior and actual update/clear
      invocation semantics; no invented logout command or repeated-init reset.
- [ ] Parent supplies existing identity-channel/seal/teardown seam evidence and
      required privacy authority; hash-only identity egress remains an invariant.

**Acceptance Criteria:**

1. Manual init identity for `em`, `ph`, `fn`, `ln`, `external_id`, `ge`, `db`,
   `ct`, `st`, `zp`, `country` reaches the real chamber and actual governed
   measurement path with the same native normalized/hash values per input.
   Presence or 64-character shape is not a passing comparison.
2. Raw/normalized inputs and documented prehashed email, plus other fields only
   after native acceptance is established, avoid double hashing. Case/space,
   Unicode, punctuation, phone-country, postal/date, empty and malformed vectors
   follow the observed native rules, not an assumed copy of CAPI's schema.
3. Anonymous -> account A -> update A -> logout -> account B journeys compare
   native merge/replace/clear behavior and every affected request. Distinct
   per-Pixel values expose stale/cross-Pixel leakage. Native absence and actual
   first-visit support are retained throughout.
4. No raw identity or unhashed fallback escapes on normal, delayed-hash,
   navigation or teardown paths. If evidence shows a required native
   representation cannot meet that invariant, block the specific case for one
   parent-routed decision; do not change hash rules or silently mark omission as parity.
5. Validate exact values privately before safe output. Report normalization,
   omission and identity-version relationships without publishing identifiers
   or value-derived hashes. Equal synthetic/redacted tokens cannot pass value
   equality or matching efficacy.
6. Wrong normalization, reused account identity, double hashing, field removal,
   stale consent and cross-Pixel leakage controls fail under C1-C9.
   Native private auxiliary matching encodings remain blocking discoveries if
   required; neither invent them nor discard them.
7. Operator reports distinguish input/hash correctness, actual wire and backend
   matching quality. Synthetic vectors prove deterministic relationships only;
   real matching/attribution needs the separately authorized 060-11 evidence.

**DoD:**
- [ ] Every field/transition/prehash path has native vectors and falsifiable controls.
- [ ] Targeted identity/browser/serialized teardown and contract regressions
      plus applicable lint pass.
- [ ] Independent compliance, craft, architecture and reconciliation reviews pass.
- [ ] Identity handling/retention and unresolved private-encoding rows are documented.

**Anti-horizontal-phasing check:** An adopter completes login/update/logout
collection safely end to end, not merely a SHA-256 utility.

## Assumptions

- Unverified: complete native normalization and update/clear semantics are
  observable and can preserve hash-only egress; neither private state keys nor
  current saved fixtures establish that.
- Unverified: existing identity/teardown seams can preserve coherent versions
  without main-thread hashing or a stable-core change.

### Close-out (post-DONE)

- [ ] Parent records board/learnings and any demonstrated representation decision.

### Deviation log (after reconciliation)

Not implemented; no matching efficacy, exact-value parity or identity API exists
by virtue of this DRAFT.

### Reconciliation sweep

Pending implementation: identity channel/privacy docs, lifecycle/cache
coherence, multi-Pixel state, private vector handling and support reports.
