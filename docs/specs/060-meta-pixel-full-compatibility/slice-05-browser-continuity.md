---
status: DRAFT
dependencies: [060-04]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-05 - Preserve anonymous and click continuity

**Goal:** A first-time or returning visitor receives native-equivalent browser
and click continuity without a native Pixel silently creating the state for Airlock.

**DoR:**
- [ ] 060-04 establishes applicable policy and per-Pixel scope.
- [ ] Parent supplies exact native cookie/transport evidence for named browser
      cohorts, approved profile/state handling and authentic authorized ClickID
      provenance for click-dependent cases; no fabricated real click is used.
- [ ] A scoped vendor-cookie/transport operation fits reviewed contracts after
      ADR-0033 acceptance; current cookie APIs and vision reconciliation are
      established by parent, not inferred or amended by this slice.

**Acceptance Criteria:**

1. Run independent wholly-replacement clean first-visit, second-page and return
   journeys with native runtime absent. Observe creation/reuse/absence of
   authorized `_fbp`/`_fbc` state and corresponding `fbp`/`fbc` wire values.
   A native-seeded cookie-only comparison does not prove first-visit support.
2. Match observed native domain/path/expiry/refresh/security attributes and
   handling of existing, expired, malformed, deleted and changed cookies.
   The server-cookie 90-day recommendation is not substituted for measured
   native behavior or actual browser restrictions.
3. No-click, same-click and changed case-sensitive `fbclid` cases preserve
   input-to-cookie-to-request relationships across navigation and allowed
   subdomains. Do not synthesize a ClickID when none exists, mutate its case or
   assume cross-site propagation.
4. Named cohorts include first/third-party allowed, third-party blocked with
   first-party allowed, all writes denied, private/partitioned and applicable
   anti-tracking states in Chromium, Firefox and WebKit/mobile variants.
   Unsupported/unavailable combinations block their rows, not the browser's
   privacy controls; no circumvention or false cookie-success fallback.
5. Actual browser transport evidence distinguishes first-party local state from
   outgoing third-party Cookie/Set-Cookie and browser-controlled headers.
   Compare credentials, methods, redirects/fan-out and responses where observed;
   do not forge browser headers or declare worker fetch/image/proxy equivalent.
6. Only exact owner-declared cookie names/scopes/attributes may be read/written/
   deleted. Worker prepares values; host enforces bounds and the seal. Arbitrary
   names/domains, stale policy and unauthorized operations fail visibly without
   a general cookie jar or identity-resolution service.
7. Wrong wire key, new ID on every page, changed ClickID/hash, excessive cookie
   scope and skipped denial controls fail under C1-C9. Generated IDs compare by
   pinned native relationships, not unrelated random byte equality or sentinels.

**DoD:**
- [ ] Clean/returning/state-corruption and denied-storage controls pass per cohort.
- [ ] Targeted browser/serialized integration, capability/contract regressions
      and applicable lint pass.
- [ ] Independent compliance, craft, architecture and reconciliation reviews pass.
- [ ] Private state/receipt evidence and public cohort/limitation reports are separate.

**Anti-horizontal-phasing check:** The visitor completes an actual returning
journey with preserved authorized continuity, not just a cookie helper test.

## Assumptions

- Unverified: native first-party behavior can be reproduced with exact scoped
  vendor-cookie operations and existing stable-core boundaries; no writer is
  authorized merely by this proposal.
- Unverified: equivalent browser policy/ClickID cohorts and actual transport
  observations are available; current owned recordings contain no such proof.

### Close-out (post-DONE)

- [ ] Parent records reviewed capability decisions, board and durable learnings.

### Deviation log (after reconciliation)

Not implemented; no continuity, cookie lifetime or new authority is claimed.

### Reconciliation sweep

Pending implementation: cookie/transport contracts, vision/ADR routing,
browser cohort matrix, identity privacy, other vendors and adoption guidance.
