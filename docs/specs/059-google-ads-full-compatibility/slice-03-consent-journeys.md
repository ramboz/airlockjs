---
status: DRAFT
dependencies: [059-02]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 059-03 - Consent-respecting measurement journeys

**Goal:** A site owner can honor the visitor's exact choices while retaining
native-equivalent basic and advanced Google Ads measurement behavior.

**DoR:**
- [ ] 059-02 is DONE; C1-C3 and exact 058 evidence layers qualify each consent case.
- [ ] Pin explicit consent inputs/timelines, effective remote overrides, region,
      positive controls and current HTTP encodings from native evidence.
- [ ] Review purpose/storage/user-data/dispatch boundaries and the host consent
      integration. Basic and advanced support are fixed requirements, not choices.

**Acceptance Criteria:**

1. **Basic mode.** Before interaction/reject, no vendor initialization or data
   transfer occurs, including loader/configuration/consent pings. A later grant
   initializes and processes native-required state/queued work; pre-grant
   conversions and callbacks follow observed native semantics, not assumed replay.
2. **Advanced mode.** Native-equivalent permitted cookieless measurements and
   consent pings execute under denied storage through the governed boundary.
   Cover all 16 granted/denied combinations of ad_storage, analytics_storage,
   ad_user_data and ad_personalization. Denied user data/personalization cannot
   be treated as merely a cookie setting.
3. Global and region/subregion defaults, unset values, remote overrides,
   partial/repeated updates, persisted choices and wait_for_update before/at/
   after expiry match native state and timing. The host/CMP, not the tag
   reimplementation, owns obtaining/persisting the visitor's choice.
4. Denied-to-granted, granted-to-denied and subsequent changes around capture,
   queue, hash, storage and actual dispatch preserve native ordering and
   permitted behavior. Record already-dispatched traffic distinctly; revocation
   cannot undo a send. Do not invent cookie deletion or held-event remapping.
5. ads_data_redaction, allow_ad_personalization_signals, restricted_data_processing
   and Google-service sharing preserve true/false/unset distinctions, native
   fields and endpoint/credential behavior. Inspect nested page/referrer/body
   values for prohibited click/identity disclosure, not only top-level parameters.
6. Existing-cookie versus fresh, browser-blocked storage despite granted consent,
   immediate navigation/unload, waiting events and conversion after revocation
   satisfy C1. Actual gcd/gcs/dma/dma_cps behavior is pinned per reference;
   undocumented codecs are not approximated or globally normalized away.
7. Removing consent enforcement, leaking a denied hash/cookie, changing a
   consent bit, replaying a forbidden event, sending a basic-denied ping or
   suppressing required advanced traffic causes a meaningful failed control.
   Expected-zero negatives cannot pass without their qualified positive.
8. Operator results distinguish native behavior, Airlock policy denial and our
   acquisition guard. They expose unsupported/unsafe contradictions without
   claiming support, meet C3, and preserve actual worker confinement and frozen
   core. Only a demonstrated conflict is escalated as one bounded decision.

**DoD:**
- [ ] Both modes, independent types and transition boundaries have retained
      positive/mutation evidence, targeted tests and applicable lint.
- [ ] Compliance, craft, architecture and reconciliation reviews pass.
- [ ] Consent operator guide and private case matrix distinguish attempted,
      actual dispatch, product and attribution layers; no subset exception.
- [ ] Implementation deviations and reconciliation are honestly recorded.

**Anti-horizontal-phasing check:** A visitor's choice produces the complete
correct browsing/conversion path and observable operator outcome in both modes.

## Assumptions

- Unverified: current consent encodings, region/remote overrides and native
  revocation/storage behavior can be captured completely with the qualified surface.
- Unverified: the reviewed core supports required advanced behavior without a
  frozen-contract break; an existing hold strategy is not itself a contradiction.

### Close-out (post-DONE)

- [ ] Parent checks consent documentation, board and durable invariants.

### Deviation log (after reconciliation)

Not implemented; no mode, encoding or transition is declared verified.

### Reconciliation sweep

Pending implementation; no consent policy or Accepted record changed here.
