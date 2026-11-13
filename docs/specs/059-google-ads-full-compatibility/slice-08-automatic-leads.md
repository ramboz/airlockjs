---
status: ABANDONED
dependencies: [059-07]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

> **Rescoped 2026-11 by [spec 065](../065-google-ads-parity-inventory/spec.md) (ADR-0061).** Replaced by G8 in spec 065 section 9. History kept; criteria are inputs to the new slice file.

## Slice 059-08 - Automatic and lead matching journeys

**Goal:** An adopter retains selector/automatic enhanced-data and lead-form
collection without unbounded page scanning, stale identities or a server-channel substitute.

**DoR:**
- [ ] 059-07 is DONE; C1-C3/058 qualify extraction, precedence, lead events and
      current native automatic-detection behavior.
- [ ] Parent supplies eligible terms/settings, selectors/variable paths,
      exclusions, owned synthetic DOM and any separately lawful product inputs.
- [ ] Review bounded typed host extraction, synchronous interactions, retention/
      joins and denial controls against ADR-0017; no eval or ambient DOM/global access.
- [ ] Identify the separate offline lead-import owner/method under current
      settings without implementing a backend or claiming browser-only attribution.

**Acceptance Criteria:**

1. Configured CSS selectors and JavaScript-variable paths obtain the same
   permitted values as native for text versus input values, missing/multiple
   matches, delayed content and supported nested paths. No arbitrary evaluation,
   unapproved getters or whole-window/DOM proxy substitutes for typed extraction.
2. Automatic detection, enabled data types, exclusions, visible/hidden/dynamic
   content and unrelated lookalike strings preserve native positive/negative
   results. The scan's breadth, scheduling and host CPU/retention remain bounded
   by reviewed C3; a manual-only replacement cannot qualify this feature.
3. Combined automatic/selector/manual methods and code-priority behavior match
   native timing and precedence. Preserve normalized full values, multi-value
   association and separate identities using 059-07's verified transformation
   rules, not a new inconsistent hashing path.
4. Prior-page data, form interaction/submission, session cookie joins, delayed
   conversion and returning/blocked-storage cohorts preserve native collection,
   expiry and clearing. Record actual host capture versus worker interpretation;
   do not assume data available at conversion came from that page.
5. Enhanced leads preserve the browser event, hashed identity/click context and
   account/destination routing needed for a later legitimate offline join.
   Offline import/API operation remains a separate dependency; it cannot
   replace missing browser requests or be silently implemented here.
6. Terms disabled, ad_user_data/storage changes and revocation prevent
   forbidden reads/retention/hashes/sends while preserving native-required
   measurement. Explicit data exclusions and unrelated forms cannot leak through
   another detection method or a stale cache.
7. Exclusion removal, missing selector, wrong timing/precedence, distinct-value
   collapse, previous-user join, dropped lead branch and empty-reference controls
   fail or become inconclusive. Under separately approved product evidence,
   distinguish browser receipt from legitimate matched offline outcome.
8. Operator diagnostics describe collection/matching limits without personal
   values. Complete C1-C3 paths run in the real chamber and preserve application
   forms, accessibility and responsiveness; no production/customer forms or
   fabricated lead submissions are required to make a local fixture green.

**DoD:**
- [ ] Each collection method, precedence, exclusion and lead case has qualified
      positive and witnessed failing controls; targeted tests/lint pass.
- [ ] Compliance, craft, architecture and reconciliation reviews pass.
- [ ] Operator guidance documents precise host scope, retention, terms and
      browser/offline responsibility split without broad privileges.
- [ ] Deviation/reconciliation records and product-evidence limitations retained.

**Anti-horizontal-phasing check:** The adopter's complete form-to-conversion or
browser-lead path works safely, not merely an extraction utility.

## Assumptions

- Unverified: native automatic heuristics and cross-page/form timing can be
  independently discriminated without unrestricted scanning or external customer data.
- Unverified: bounded host extraction can satisfy the complete required native
  surface and numeric budgets; any demonstrated conflict must be reviewed individually.

### Close-out (post-DONE)

- [ ] Parent checks collection/lead guidance, coverage and board.

### Deviation log (after reconciliation)

Not implemented; no automatic extraction or offline matching is declared proven.

### Reconciliation sweep

Pending implementation and formal review.
