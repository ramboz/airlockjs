---
status: IN_PROGRESS
dependencies: [058-01, 058-02, adr-0033]
last_verified:
frame_review: true
arch_review: true
claimed_by: google-and-meta-feasibility
---

## Slice 058-04 - Owned Google conversion attempted-reference

**Goal:** An operator can run newly pinned official Google Ads resources offline
and distinguish observed owned conversion attempts from missing native inputs.
This is a new source cohort, not repair of the incomplete historical capture.

**DoR:**
- [x] Owner approved read-only owned script/configuration downloads and offline
      qualification on 2026-10-16, without measurement dispatch or site changes.
- [x] Newly acquired resource provenance and exact owned selectors are supplied
      through an explicit private manifest.
- [x] The frame critique and normal implementation-entry gates clear.

**Acceptance Criteria:**

1. Acquisition is distinct from execution. Only credential-free GET downloads
   of the owned tag's verified official Google script/configuration URLs are
   allowed; no redirects, measurement endpoints, live events, customer/Intuit
   access, account/site changes or automatic execution. Retain exact URLs,
   response status/headers, time, raw bytes and byte digests privately. Bound
   acquisition to eight requests, 2 MiB per file, 8 MiB total and 20 seconds per
   request. Missing historical responses remain missing.
2. Extend the existing fixed native-reference command with a narrowly named
   `google-ads-conversion` profile. Validate the explicit private manifest,
   owned conversion destination/action, resource URL/status/digest and newly
   qualified fixed native byte pins before execution. A self-consistent
   synthetic/no-op runtime cannot qualify as official code. No download or
   arbitrary-executable option is added to the runner.
3. Native bytes execute unchanged in the existing qualified headed Chrome,
   Node and macOS cohort. Before execution, re-witness the same process,
   known-resolver and HTTP containment controls. Preserve the fixed shared
   policy and all-fulfill/abort request-stage interception; there is no native
   network-continue arm. Missing dependencies, unsupported targets/transports,
   CSP violations, body/header loss, limits or incomplete cleanup are explicit
   inconclusive outcomes, not reasons to relax the boundary.
4. Locally fulfill only exact pinned resource URLs, including query/order,
   with proven source bytes. The owned-origin document and standard
   `dataLayer`/`gtag` bootstrap are generated fixture inputs and labeled as
   such. No captured-source-document or historical-runtime claim is made.
5. The fixed matrix is baseline, query-disabled, value1 and value2. Every
   positive requires actual native runtime execution and an owned primary
   conversion attempt with exact action, currency, value and transaction-ID
   relationships; the disabled case requires zero runtime/configuration and
   measurement attempts and is linked to a qualified positive. Capture every
   observed auxiliary request; do not discard unknown traffic to obtain a pass.
6. Compare the deliberately distinct input values before privacy
   transformation and require their exact wire relationships. Empty positives,
   missing/altered pinned input, missing primary conversion and changed-value
   mutations must fail or become inconclusive, never qualify. Do not reuse
   Meta's revoke-before-init behavior as a Google consent contract.
7. Reports retain the shared schema/state/exit semantics, identify the new
   profile/source cohort and pre-response `native_attempt` evidence layer,
   and keep raw selectors/URLs/cookies/content only in owner-only files.
   Dispatch, actual measurement responses, response-dependent fan-out,
   matching, reporting, attribution, chamber execution, other consent states
   and full vendor replacement remain explicitly unproved.
8. Existing Meta profile behavior and controls remain unchanged. No core,
   connector, Adobe, global oracle, `.servo` approval, site or deployment
   changes. Qualification is limited to actual passing receipts; an unresolved
   native dependency/surface leaves this slice unfinished.

## Grounding

The existing command's actual process/resolver/HTTP controls and exact-resource
fulfillment are implemented in `rig/native-tag-reference.mjs:260-690`; its
existing Meta-only input/profile gate is in `:127-166`. The original Google
input-readiness artifact is explicitly supplied by its owning session and
records absent loader bytes and incomplete historical responses. New source
acquisition is separately authorized; it cannot establish the old version.

## Assumptions

- The currently served owned Google resources can produce an owned conversion
  attempt without unsupported browser surfaces under the existing boundary.
  Test this; otherwise retain an inconclusive receipt and the exact blocker.
- Required script/configuration dependencies can be identified without
  following measurement endpoints or disclosing customer data. An unclassified
  dependency remains blocked, not permission to fetch it.

**DoD:**
- [ ] Genuine source provenance and native positive/off/value receipts exist.
- [ ] TDD, targeted regression checks and required independent reviews pass.
- [ ] Operator documentation and live readiness prose match the evidence layer.
- [ ] Actual reconciliation/commit/DONE gates clear; no wider claim follows.

**Anti-horizontal-phasing check:** The operator gets one bounded Google command
with either qualified attempted-request evidence or actionable missing inputs.

### Close-out (post-DONE)

- [ ] Regenerate/check the board and preserve evidence/accounting boundaries.

### Deviation log (after reconciliation)

Not implemented.

### Reconciliation sweep

Pending implementation.
