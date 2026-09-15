---
status: DRAFT
dependencies: [adr-0030]
last_verified:
arch_review: true
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section — never assert an
     unverified claim as fact. -->

## Slice 049-01 — runtime-`<script>` suppression (CWV-win core, dist-shipped)

**Goal:** Ship a config-driven, adopter-facing suppressor (`adapters/eds/`) that, installed **before** a tag-manager
container loads, blocks the migrated vendors' runtime `<script>` injections by **URL/query matcher** — carving out airlock's
own arm egress and emitting a per-suppression diagnostic — so an EDS adopter (via the airlock dist subtree) gets the
TBT/CWV-win after-arm ([ADR-0029](../../decisions/adr-0029-mvp9-developer-side-after-arm.md)) with no container-profile
change. For the four trial vendors (all `gtag.js`/`fbevents.js`) this also suppresses their native beacons (no runtime → no
beacon), so it is the complete after-arm for runtime-based tags.

**Why `arch_review: true`.** This adds a NEW public adopter-facing surface (a served dist sibling + its config contract) —
the vendor-generic suppressor API (the matcher shape, the carve-out semantics, the diagnostic record) that ADR-0030
ratified and every future adopter depends on. Its home (`adapters/eds/`, not `core/`) and its dist packaging are
boundary-shaped.

**DoR:**
- ✅ [ADR-0030](../../decisions/adr-0030-native-tag-suppressor.md) Accepted — the mechanism (runtime+beacon, URL/query
  granularity, airlock-egress carve-out, vendor-neutral, adopter-facing layer) is ratified.
- ✅ The dist served-sibling mechanism exists (spec 031 / `build.mjs`'s `ENTRY`/reserve-personalization pattern) — a new
  served ESM entry is additive.
- ✅ The Playwright real-browser rig harness pattern (`rig/*.mjs` + a served HTML harness) exists — the vehicle to ground A2.
- ◻️ (soft, resolved IN this slice) A2: pick the interception technique that PREVENTS the runtime load (not just observes
  it) and prove network-0 for a blocked runtime in a real browser under the reference CSP.

**Acceptance Criteria:**

1. **Config-driven, vendor-neutral suppressor installed before the container.** A new `adapters/eds/` module exposes an
   `installTagSuppressor({ suppress: Matcher[], allow?: Matcher[], onDiagnostic? })` (names indicative) where a `Matcher`
   keys on URL **path + query** (e.g. host + pathname + a required `?id=` value), NOT bare host. Installing it patches the
   page's script-injection seam so a subsequently-injected `<script>` whose resolved `src` matches a `suppress` matcher is
   neutralized before it loads. No vendor name is hardcoded (grep-clean of `gtag`/`fbevents`/`google`/`facebook`/`AW-`/`DC-`
   in the module — vendor-neutral, ADR-0018 R2).
2. **A blocked runtime never downloads or evaluates (the TBT/CWV-win proof, real browser).** A GATING Playwright rig
   (`rig/tag-suppressor.mjs` + a served harness) installs the suppressor, then injects a matching vendor-runtime `<script
   src>` the way a container does (`document.createElement('script')` + append), under a CSP mirroring the reference site's
   (Trusted Types + `strict-dynamic`): the network shows **zero** request for the blocked `src` AND the runtime's global
   side effect never appears (a sentinel the fake runtime would set is absent). A NON-matching injected script loads
   normally (the suppressor is scoped, not a blanket block). This is the Node/vitest-ineligible proof A2 requires (no real
   Worker/DOM/network in vitest).
3. **The airlock-egress carve-out wins by construction.** Given an `allow` set of the booted connectors' endpoints, a
   `suppress` matcher that would otherwise match airlock's OWN egress (e.g. an over-broad `www.google-analytics.com`
   matcher vs airlock's `/mp/collect`) does NOT suppress it — the allow-set takes precedence. Tested: airlock's
   `/mp/collect` script/endpoint survives an over-broad adopter `suppress`; the container's `/g/collect`-family runtime is
   still blocked.
4. **Partial migration of a shared-host runtime.** Matchers discriminate a `?id=` subset of a shared host: a `suppress`
   matcher for `googletagmanager.com/gtag/js?id=AW-…` blocks the Google Ads runtime while `…?id=G-…` (GA4) injected on the
   same host is left to load (partial migration — migrate Ads, keep GA4 in the container). Proven by URL/query match, not
   host.
5. **Loud per-suppression diagnostic (028-shaped).** Each suppression emits an `onDiagnostic` record (reusing spec 028's
   sink shape) naming what was suppressed (the matched URL + which matcher), so an over-match is observable, not silent. A
   near-miss (a non-matching script) emits nothing.
6. **Shipped as a served dist sibling.** A new `build.mjs` served-ESM entry emits the suppressor as a `dist` artifact
   (alongside `eds.js`/`reserve-personalization.js`), listed in `DIST_ARTIFACTS`, so `git subtree add`ing the airlock dist
   carries it and an EDS adopter imports it from `scripts/airlock/`. `npm run build` + the bundle-layout assertions stay
   green; the pinned dist-artifact test (if any) is updated.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC; the vendor-neutral grep guard (AC1), the carve-out (AC3), and the
      partial-migration matcher (AC4) are explicit unit tests; AC2 is the GATING real-browser rig (network-0 for a blocked
      runtime under the reference CSP), wired into CI's browser-oracle job.
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore) — especially the carve-out (remove it
      → airlock's own egress gets suppressed → red) and the network-0 rig (weaken the interception → the blocked runtime
      loads → red).
- [ ] Reviewed by `reviewer` subagent (compliance) + craft pass + arch pass (`arch_review: true`).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred during implementation (e.g. additional injection
      vectors, or the exact interception technique's residual edges).

**Anti-horizontal-phasing check:** after this slice lands, an EDS adopter can subtree the airlock dist, import the
suppressor, declare URL/query matchers, and see a container's vendor **runtime scripts (and their beacons) suppressed
before load** in a real browser — the TBT/CWV-win after-arm, end-to-end — while airlock's own egress is protected. Not
intermediate state; a usable primitive.

## Assumptions

- **A2 (this slice grounds it) — the chosen interception technique prevents the load.** The exact seam (a
  `createElement`/`appendChild`/`insertBefore` patch neutering a matching node at insertion, vs a `MutationObserver`
  removing it before eval) is picked here and proven network-0 in AC2's real-browser rig under the reference CSP. If NO
  page-side technique can prevent the load for a given injection vector, that vector is the ADR-0030 kill criterion
  (profile-side fallback) — recorded, not silently skipped.
- **A3 — the carve-out is load-bearing** (airlock's `/mp/collect` shares a host with the container's `/g/collect`) — AC3
  pins it.

### Deviation log (after reconciliation)

_TODO at reconciliation._

### Reconciliation sweep

_TODO at reconciliation._
