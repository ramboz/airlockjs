---
status: DRAFT
dependencies: [060-02, 060-04, 060-05, 060-06, 060-08]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-09 - Measure navigation, exit and no-JavaScript journeys

**Goal:** A visitor can navigate, leave or use a no-JavaScript path without
unexplained collection loss, duplicate events or a policy bypass.

**DoR:**
- [ ] Event, policy, continuity, identity and automatic journeys 02/04/05/06/08
      are available with named native references.
- [ ] Parent supplies controlled single-page application (SPA), history,
      visibility, BFCache, prerender and rapid-exit reference conditions across
      the declared browser/transport cohorts, with measured timing/loss criteria.
- [ ] A separately authorized no-JavaScript fixture/reference and a precise
      site-owned policy-preserving fallback are established. Current static
      noscript omission remains unchanged; static/edge facilities are not presumed.
- [ ] Proposed lifecycle transport fulfillment fits stable-core contracts and
      performs only already-serialized operations behind the seal.

**Acceptance Criteria:**

1. Hard navigation, pushState/replaceState/popstate/hash changes and explicit
   PageView calls preserve native URL/referrer/metadata, call timing and counts.
   A no-explicit-call control determines any actual native automatic history
   behavior; the historical hash-route sample alone cannot establish it.
2. Click, scroll/visibility, developer delays, foreground/background, BFCache
   restore and prerender transitions preserve actual callbacks, default site
   behavior and automatic-rule effects under C1-C9.
3. Rapid exit, pagehide/navigation, cold/warm startup, slow worker/hash and
   offline/intermittent transport record surviving/cancelled attempts, retries,
   duplicates, time/order and loss. Repeated trials apply pinned measured
   criteria; a single receipt is not an exactly-once guarantee.
4. Browser-required image/fetch/beacon or other discovered transports remain
   explicitly mediated with correct credentials, browser-controlled headers/
   cookies, responses and redirect/fan-out effects. No arbitrary proxy or
   forged header is substituted to hide a mismatch.
5. The host may fulfill a bounded pre-serialized lifecycle lease only with
   current consent/destination/identity validity; no main-thread mapping/
   hashing, blocking unload or stale replay. Forbidden, delayed and cancelled
   dispatches are reported truthfully rather than success-shaped loss.
6. In a distinct approved no-JavaScript journey, the site-owned governed
   fallback reproduces the pinned native image/other applicable behavior and
   actual browser/wire response while respecting required query/policy choices.
   This is not worker execution. Do not re-add the current omitted image,
   assume static markup can inspect queries, or accept absence as full parity.
   An infeasible required path remains blocked for an evidence-specific decision.
7. Missing/extra navigation events, changed URL/hash/identity, late revoked
   release, retry duplication, a lost exit and policy-bypassing no-JavaScript
   emission are falsifiable controls. Attempt-only interception cannot close
   actual delivery/redirect/cookie criteria, and owner receipt cannot fill them.
8. The operator can trace a lifecycle event across capture, preparation,
   attempted/actual transport and loss with safe public reasons, including
   explicit unavailable evidence. No browser cohort is silently dropped.

**DoD:**
- [ ] Declared lifecycle/browser/no-JavaScript matrix and loss/mutation controls pass.
- [ ] Targeted browser, lifecycle, contract and policy regressions plus lint pass.
- [ ] Independent compliance, craft, architecture and reconciliation reviews pass.
- [ ] No-JavaScript and timing feasibility decisions are actually reviewed;
      measured limits and residuals remain visible.

**Anti-horizontal-phasing check:** Visitors complete navigation/exit/no-JavaScript
measurement paths and operators can explain actual outcomes end to end.

## Assumptions

- Unverified: native timing/transport survival can be preserved by bounded
  already-serialized host fulfillment without main-thread interpretation.
- Unverified: an available site-owned no-JavaScript path can preserve native
  collection and policy without a worker. This is an essential discovery
  requirement, not a demonstrated contradiction or approved exclusion.

### Close-out (post-DONE)

- [ ] Parent records board/learnings and actual bounded decisions; preserve the
      history of the separate test-setup noscript omission.

### Deviation log (after reconciliation)

Not implemented; no unload delivery, SPA automation or no-JavaScript parity claimed.

### Reconciliation sweep

Pending implementation: lifecycle/boot docs, host transport leases, identity/
consent coherence, no-JavaScript policy, browser matrix and measured performance.
