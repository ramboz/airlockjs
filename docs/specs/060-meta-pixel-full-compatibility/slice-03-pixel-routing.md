---
status: DRAFT
dependencies: [060-01, 060-02]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-03 - Route and configure multiple Pixels

**Goal:** An adopter runs two independently configured Pixels and sends each
event only to the native-equivalent destinations with no cross-Pixel data leakage.

**DoR:**
- [ ] 060-01/02 are complete for the applicable event and reference surfaces.
- [ ] Two owned source handles, settings provenance and a finite routing
      experiment grant are supplied; no second source is provisioned implicitly.
- [ ] Parent identifies routing/configuration ownership and the complete relevant
      fbq/set option inventory, including unknown remote configuration branches.

**Acceptance Criteria:**

1. In the actual replacement, `track`/`trackCustom` broadcast and
   `trackSingle`/`trackSingleCustom` targeting match the pinned native two-Pixel
   inputs, including request order/count and absence at the other Pixel.
2. Each Pixel retains its own init data, configuration and identity state.
   Distinct safe synthetic values reveal cross-Pixel contamination; identical
   redaction sentinels or repeated placeholder IDs cannot prove isolation.
3. Calls before/after either init, repeated IDs, late initialization, duplicate
   snippets and invalid/uninitialized targets have observed native behavior
   and visible errors. Unknown `set` subcommands/options block their support
   row rather than silently doing nothing.
4. Evidence-backed per-Pixel settings, including `autoConfig` placement/type,
   are applied to the correct Pixel and produce the same whole-sequence and
   browser effects. Do not infer privacy-option global/per-Pixel scope; 060-04
   qualifies that state machine.
5. Configuration updates use declared, bounded, per-Pixel source/operation
   references and integrity/version provenance. Native dependency/configuration
   behavior is accounted for under C3; no arbitrary remote code runs on the
   privileged main thread or brings the native runtime into the replacement.
6. Wrong-target, extra broadcast, missing fan-out branch, stale configuration
   and cross-Pixel identity mutations all fail the appropriate comparisons.
   Unauthorized target/configuration access is denied with visible reason.
7. The adopter/operator can inspect target selection and configuration
   provenance per call without public IDs or secrets. C1-C9 and unchanged
   stable-core/other-vendor behavior remain required.

**DoD:**
- [ ] Two-Pixel positive, no-leakage, stale-config and negative controls pass.
- [ ] Targeted routing/integration/contract regressions and applicable lint pass.
- [ ] Independent compliance, craft, architecture and reconciliation reviews pass.
- [ ] Per-option support/discovery and required private access are documented.

**Anti-horizontal-phasing check:** The adopter can operate two actual
destinations safely end to end, not merely configure a routing table.

## Experimental construction - 2026-10-29

The source-only prototype now optionally retains up to four distinct local
Pixel IDs, broadcasts in initialization order and targets one initialized ID.
Actual serialized first-party Node worker/loopback tests check request counts,
target isolation, duplicates, the limit, consent changes between branches,
partial HTTP failure and terminal transport failure. Each branch crosses the
existing strict consent and destination boundary; redacted outcomes distinguish
submitted-to-host from selected branches. Host submissions include held branches
and are not network-attempt counts. This is not a native two-Pixel comparison.
The experimental adapter now also rejects malformed, extra-field or
inconsistent multi-Pixel worker summaries before exposing outcomes; a rejected
summary terminates the adapter with `invalid-worker-result`.

Initialization, ordering, error and failure-continuation rules are prototype
choices, not observed native behavior. Per-Pixel identity, settings, remote
configuration, browser behavior and actual vendor transport remain open. No
owned Pixel, second source, browser, vendor endpoint or production boot was
used or enabled. The DoR, acceptance criteria and DRAFT status are unchanged.

## Assumptions

- Unverified: complete relevant `set` and remote configuration behavior can be
  discovered and reproduced with per-Pixel authority and no ambient execution.
- Unverified: existing routing/state seams isolate multiple Pixels; the single
  Pixel snapshot supplies no such current-code proof.

### Close-out (post-DONE)

- [ ] Parent records board/learnings and reviewed extension decisions if any.

### Deviation log (after reconciliation)

Not implemented; no multi-Pixel or configuration isolation is claimed.

### Reconciliation sweep

Pending implementation: routing/configuration docs, capability declarations,
state isolation, shared-source behavior and operator reports.
