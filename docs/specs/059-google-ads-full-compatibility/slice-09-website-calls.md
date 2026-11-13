---
status: ABANDONED
dependencies: [059-04]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

> **Rescoped 2026-11 by [spec 065](../065-google-ads-parity-inventory/spec.md) (ADR-0061).** Replaced by G9 in spec 065 section 9. History kept; criteria are inputs to the new slice file.

## Slice 059-09 - Website-call forwarding journey

**Goal:** An adopter's owned website number is correctly replaced and callable
through the native-equivalent governed lookup, cache, callback and rendering path.

**DoR:**
- [ ] 059-04 is DONE; C1-C3/058 qualify lookup/response/rendering references.
- [ ] Parent supplies eligible country/account, owned displayed number, call
      action/label and private configuration; lookup, any legitimate ad-associated
      visit and any real call each need separate finite authority.
- [ ] Pin current native call-consent behavior. Documentation that support is
      pending is not proof of actual behavior or permission to bypass the seal.
- [ ] Review narrowly typed phone text/tel operations and callback correlation;
      no raw response scripts/HTML, arbitrary DOM writes or frozen-core change.

**Acceptance Criteria:**

1. The supported phone snippet/config forms, phone_conversion_number/ids and
   actual owned label produce native-equivalent lookup and full response
   branches. A click-to-call conversion ping is not a forwarding lookup or a
   duration-qualified backend call conversion.
2. Response number formatting, phone_conversion_callback arguments/count/order,
   CSS-class and custom-element paths preserve displayed and plain/callable
   values. A callback path that changes tel: href also changes it consistently
   with display text without arbitrary HTML execution.
3. phone_conversion_options timeout/cache and applicable native cookie behavior
   match first/returning, expired, disabled-cache and blocked-storage cases.
   Treat documented defaults as reference inputs to verify, not an invented
   retry/lifetime policy.
4. Eligible versus direct/non-ad-associated visits, unsupported country/number
   formatting and supported multiple-number arrangements are explicit cases.
   Unknown native combinations block coverage instead of accepting a single
   happy-path number as full call support.
5. No result, malformed response, network error, timeout, repeated callback,
   delayed DOM and navigation preserve the native application outcome, including
   unchanged callable business number when appropriate. Response-derived
   actions stay on approved elements/fields and preserve accessibility.
6. Relevant consent choices, revocation, lookup/cache reads and retained data
   satisfy governed policy and pinned native behavior. If actual required native
   behavior contradicts a core invariant, stop that case for one evidenced owner
   decision; no call-consent exception or broad network/DOM grant is assumed.
7. Wrong display/callable number, cache reuse/expiry error, extra lookup,
   altered callback, unauthorized element mutation and dropped response branch
   produce failing controls. Saved local responses test conditional behavior
   only; they cannot impersonate actual number allocation or backend call receipt.
8. Operator results separate lookup attempts, real responses, rendered state,
   legitimate call/product evidence and attribution. C1/C3 include actual worker
   parsing/state, minimal host operations, layout/input impact and failure
   isolation. No paid ad click or actual call is inferred from setup authority.

**DoD:**
- [ ] Lookup/cache/callback/rendering/consent scenarios have positive and
      witnessed failing controls; targeted tests and applicable lint pass.
- [ ] Compliance, craft, architecture and reconciliation reviews pass.
- [ ] Call setup, safe failure, product-evidence and access limits are documented.
- [ ] Honest deviation/reconciliation records include DOM and core-contract impact.

**Anti-horizontal-phasing check:** The site's real user-visible number and
clickable phone target work through a complete governed lookup/render journey.

## Assumptions

- Unverified: current native call-consent and eligible lookup/cache behavior
  can be safely discriminated; the general pending-support notice is insufficient.
- Unverified: typed rendering and timing requirements fit the stable core and
  C3 without unrestricted DOM/script execution.

### Close-out (post-DONE)

- [ ] Parent checks call guidance, safety boundaries and board.

### Deviation log (after reconciliation)

Not implemented; no lookup, call, spend or DOM authority granted by this draft.

### Reconciliation sweep

Pending implementation and formal review.
