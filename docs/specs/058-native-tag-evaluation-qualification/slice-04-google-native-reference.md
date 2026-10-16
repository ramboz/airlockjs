---
status: RECONCILED
dependencies: [058-01, 058-02, adr-0033]
last_verified: 2026-10-16
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
- [x] Genuine source provenance and native positive/off/value receipts exist.
- [x] TDD, targeted regression checks and required post-implementation reviews pass.
- [x] Operator documentation and live readiness prose match the evidence layer.
- [ ] Actual reconciliation/commit/DONE gates clear; no wider claim follows.

**Anti-horizontal-phasing check:** The operator gets one bounded Google command
with either qualified attempted-request evidence or actionable missing inputs.

### Close-out (post-DONE)

- [ ] Regenerate/check the board and preserve evidence/accounting boundaries.

### Deviation log (after reconciliation)

Implemented the fixed Google profile in the existing runner without changing
the policy, launcher, cohort, no-send arms or limits. One credential-free
official source GET retained the new loader; runtime bytes remain unchanged.
The initial trace correctly blocked uncatalogued auxiliaries. Static source
byte-span and private relationship evidence then established a narrow catalog:
measurement-response Script/Image, remarketing, CCM and selector-free
same-case-correlated requests. These remain aborted; no measurement response
was downloaded or fulfilled. AUID correlation is not independent authentication
or a complete initiator proof.

The parent native receipt records 43 requests, six primary and 24 auxiliary
attempts: baseline/value1/value2 each have two primary plus eight auxiliaries,
query-disabled has zero. Exact action/value/currency/transaction and source
relationships pass, with Google consent proof deliberately false. Process,
known-resolver and HTTP controls and all owned cleanup pass.

Initial integrated validation was 89 pass/one unknown-auxiliary failure. Its
temporary diagnostic had been deleted; the cause remains unknown. The test now
retains failed private positives without relaxing any expectation, guard,
catalog or oracle. The complete explicitly enabled rerun passed 90 cases,
including real Google value mutations and retained Meta/headless/revoke/URL
controls; 28 unchanged local controls also pass. Eight parent complete matrices
qualified. A distinct retained extra `chrome://newtab/` target correctly caused
an inconclusive run; it is not asserted to explain the earlier lost failure.
No universal repeatability or absence-of-unknown-behavior claim follows.

Native event attempts under interception can differ from an uninterrupted
response chain. Historical missing bytes/responses, actual vendor responses,
Google consent variants, other scenarios/cohorts, initiator/ownership
authentication, comparison, chamber and downstream outcomes remain open.
Actual compliance follow-up, craft and architecture passes clear the REVIEWED
gate. The initial compliance blocker remains in Git history. Reconciliation,
implementation commit and final DONE remain separate required gates.

### Reconciliation sweep

- Scope: this slice's changes start after inherited branch checkpoint
  `a7a3aee`. Earlier ADR-0033/058-01/058-02 work and integrated 059/060 packets
  are excluded from this pass except for the explicitly updated live surfaces
  below. Inherited branch-wide diff content is not a new 058-04 deliverable or
  a renewed review of closed records.
- Updated: `README.md` describes both selected offline profiles without full
  support or historical-response claims; `CLAUDE.md` carries the active 058
  checkpoint and remaining comparison/readiness gates.
- Updated: `docs/architecture.md` corrects the live shared-evaluation status
  while preserving stable-core/runtime/Adobe boundaries; `docs/refinement-todo.md`
  distinguishes new Google evidence from historical and full-vendor residuals.
- Regenerated: `docs/specs/README.md` derives the actual slice states via the
  workflow helper; its curated notes are preserved, not used to grant authority.
- Updated: shared live overview/plan/tasks and operator guide distinguish the
  newly acquired Google cohort from completed retained Meta and old Google
  history; the initial compliance blocker is preserved in Git.
- Updated: DRAFT 059 prerequisites name the Google-specific 058-04 layer, while
  complete response/dispatch and numerical/performance/readiness gates remain.
- No-op: 058-01/02 closed records, Accepted ADRs, conventions, core/connectors,
  Adobe/site assets, global oracle and `.servo` approvals. No public runtime
  module boundary or frozen API changed; this reuses the established local
  qualification design rather than selecting a new architecture.
- Deferred: 058-03 comparison, full vendor inventories, universal reproducibility,
  the lost-trace unknown's cause, additional native capabilities and live sends.
- Updated: memory learning preserves measurement-Script classification versus
  acquisition authority and the lost-diagnostic limitation. Coverage advisory
  shows no missing/dangling use cases; older unrelated orphans are unchanged.
- Leanness: one profile variant reuses the existing command/containment and
  targeted test file. No new dependencies, generic framework or runtime APIs.
- No-op: inbox/brand/UI/lightweight decisions; all work remains under this slice.
- Pending: reconciliation review and commit/DONE gates, with actual results in
  the sibling review evidence rather than inferred from passing author tests.
