---
status: DRAFT
dependencies: [060-03]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-04 - Apply consent and processing choices

**Goal:** A visitor's consent changes and an operator's processing instructions
govern actual collection and dispatch without stale replay or misleading success.

**DoR:**
- [ ] 060-03 supplies isolated routing/configuration and positive references.
- [ ] Owner's applicable consent/data-processing policy is explicit; controlled
      native evidence resolves revoke/grant/re-grant, retention/replay,
      cookie/DOM/config effects and per-Pixel/global scope.
- [ ] P17's dpo/vdpo inconsistency and native privacy encodings are resolved
      for each tested case; no legal-coverage or region list is assumed exhaustive.

**Acceptance Criteria:**

1. Revoke before init, events while revoked, grant, event, revoke again, more
   events and re-grant follow the pinned native state transitions through actual
   chamber and host. Repeat on navigation with revoke reapplied as required.
   Record retention, flush/drop, ordering and duplicate counts explicitly.
2. The applicable seal policy is rechecked at each dispatch/redirect and
   timing-critical path. A stale grant/version, queued identity or previously
   prepared request cannot release data after revocation contrary to policy.
3. Observe and compare script/config fetching, cookies, automatic/manual
   collection and egress separately. Do not equate pausing fires with stopping
   all collection or clearing every cookie, and do not invent native replay.
4. `dataProcessingOptions` empty, LDU automatic-location and documented explicit
   location cases, plus observed mid-page changes, produce native-equivalent
   fields and scope for every relevant request family. Preserve omitted versus
   empty values; LDU is not consent or a no-send guarantee.
5. Multi-Pixel and browser-cohort cases show the actual setting scope and
   no unintended release. `meta-pixel=off` remains a separate initialization
   choice, not a substitute for revoke/grant or data-use options.
6. Positive permitted sends, paired denied cases, delayed consent updates,
   repeated grants and altered privacy-field controls are falsifiable under
   C1-C9. No recording with both positive/negative paths empty can pass.
7. Operators see why each event was captured/held/replayed/dropped/denied and
   which policy version applied, without private values in public reports.
   A demonstrated native-versus-policy contradiction blocks that case for one
   parent-routed owner decision; no silent collection loss or blanket waiver.

**DoD:**
- [ ] Full transition matrix and stale-release/privacy mutation controls pass.
- [ ] Targeted actual-dispatch, contract and consent regressions plus lint pass.
- [ ] Independent compliance, craft, architecture and reconciliation reviews pass.
- [ ] Policy/native differences and all remaining cohorts remain visible.

**Anti-horizontal-phasing check:** A visitor changes a real choice and the
operator observes the resulting governed request behavior across the whole path.

## Experimental construction - 2026-10-29

The separately gated `experimentalTagConsent` local prototype accepts the
documented `consent` revoke and grant commands through the serialized worker.
The trusted host intersects tag permission with independent host ad-storage
consent. An admitted revoke immediately blocks later branches and invalidates
earlier captured events; a grant cannot override host denial or release an
event invalidated by revoke. Held events do not replay, and already dispatched
requests cannot be recalled. Tests use synthetic inputs, a real worker and
loopback receiver, and fake-worker controls. Default behavior is unchanged.

The retained reference fixture issues revoke before init and the owner reports
that its retained control observed no PageView. This single no-send observation
does not establish native grant/re-grant, queue retention, replay, global scope,
cookie/collection effects or the prototype's initial state and timing rules.
Those are local safety choices, not a native-equivalence or acceptance result;
all readiness and production gates above remain open.

## Assumptions

- Unverified: native retention/re-grant and privacy semantics can be evaluated
  under equivalent state; short public pause/resume examples are insufficient.
- Unverified: those semantics can coexist with the owner's policy and existing
  seal/versioning seams without a stable-core change. No contradiction is proven.

### Close-out (post-DONE)

- [ ] Parent records board/learnings and any specific reviewed policy decision.

### Deviation log (after reconciliation)

No native consent, replay or legal-compliance qualification claimed.

### Reconciliation sweep

Pending implementation: consent/purpose documentation, processing vocabulary,
cookie/automatic/lifecycle paths, operator diagnostics and shared policy records.
