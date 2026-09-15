---
status: DONE
dependencies: [adr-0030]
last_verified: 2026-09-15
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
beacon), so it is the complete after-arm for runtime-based tags — **completeness conditional** on the four being
pure-runtime tags (not container-fired direct pixels); a direct-pixel miss is covered by 049-02 + the ADR-0030 kill
criterion, and the pure-runtime check is a 050-trial verification.

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
   **full DOM script-insertion surface** — `appendChild` / `insertBefore` / `append` / `prepend` / `insertAdjacentElement` /
   `replaceChild` (the vendor-snippet idiom is `parentNode.insertBefore(script, firstScript)`, not just `head.appendChild` —
   A1) — so a subsequently-injected `<script>` whose resolved `src` matches a `suppress` matcher is neutralized **before it
   connects to the document** (pre-fetch, not a post-insertion `MutationObserver` — A2). No vendor name is hardcoded
   (grep-clean of `gtag`/`fbevents`/`google`/`facebook`/`AW-`/`DC-` in the module — vendor-neutral, ADR-0018 R2).
2. **A blocked runtime never downloads or evaluates (the TBT/CWV-win proof, real browser).** A GATING Playwright rig
   (`rig/tag-suppressor.mjs` + a served harness) installs the suppressor, then injects a matching vendor-runtime `<script
   src>` **the way real vendor snippets do — `parentNode.insertBefore(script, firstScript)` (the gtag/fbevents idiom), plus
   an `append`/`insertAdjacentElement` variant** — under a CSP mirroring the reference site's (Trusted Types +
   `strict-dynamic`, via a response header like `rig/sanitize-boundary.mjs`): the network shows **zero** request for the
   blocked `src` AND the runtime's global side effect never appears (a sentinel the fake runtime would set is absent — the
   dual assertion defeats a cached-runtime confound; gate on network-0 + sentinel, NOT browser-sensitive CSP-violation
   events). A NON-matching injected script loads normally (the suppressor is scoped, not a blanket block). This is the
   Node/vitest-ineligible proof A2 requires (no real Worker/DOM/network in vitest).
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

Original ACs preserved above; deviations append here (2026-09-15). The slice shipped green after a pre-implementation
frame-critique refinement + one review fix round (compliance **pass**, craft + arch **pass** after fixing one blocker each).

1. **Diagnostic record flattened (arch + compliance [blocker]).** AC5's diagnostic originally carried a nested `matcher`
   object. That would have made the suppressor the FIRST nested-value emitter into spec-028's inspector collector, whose
   shallow copy-on-write documents a **flat-record invariant** (`core/inspector/collector.js:53-60`) — a nested
   `matcher.query` would alias/corrupt a buffered ring row. Flattened to primitive fields `{ level, kind, disposition, url,
   matcherHost, matcherPathname, matcherQuery }` (`matcherQuery` a serialized `&`-joined `key=value` string). This is the
   **initial** public diagnostic contract (049-01 first ships the suppressor — nothing broken). Residual (cosmetic, noted):
   `matcherQuery` is a human-facing label; a value containing `&`/`=` would be ambiguous to a future machine-parser — not
   worth a fix at AC5's "attributable, not machine-parsed" scope.
2. **Full 6-method insertion-surface coverage (craft [blocker]).** AC2's rig originally enumerated `insertBefore` +
   `append`/`insertAdjacentElement`; that left `prepend` + `replaceChild` (2 of the 6 patched methods) driven by no test —
   removing either patch stayed green, failing the mutate→red DoD + proving AC1's "full surface" only 4/6. Extended the
   harness + rig to drive **all six** (`appendChild`/`insertBefore`/`replaceChild`/`append`/`prepend`/`insertAdjacentElement`),
   each network-0 + sentinel-absent, plus a `replaceChild` placeholder-survival assertion (proves neutralize semantics, not
   just network-0). Mutation-verified per method.
3. **Frame-critique refinements (pre-implementation, folded into the DRAFT).** A1 corrected: only `utag.js`/the consent
   stack are `appendChild`-verified in-source; vendor runtimes (`gtag.js`/`fbevents.js`) use the `parentNode.insertBefore`
   idiom — so the suppressor patches the **full** insertion surface. The "no runtime → no beacon" completeness is hedged
   (conditional on the four being pure-runtime tags; a direct-pixel miss → 049-02 + the ADR-0030 kill criterion; the
   pure-runtime check is a 050-trial verification).
4. **Nits addressed in-slice (not deferred).** (a) matcher lists now **compile once** at install (`state.compiledSuppress`/
   `compiledAllow`) — the hot per-insertion path (`shouldSuppressCompiled`) never recompiles (a module that exists to WIN
   CWV must not tax the hottest DOM path). (b) the suppressor's build blob/data worker-URL-scan exclusion is now
   **self-defended** (a `new Worker(` in `tag-suppressor.js` fails the build), mirroring the reserve sibling, with a seeded
   regression test.
5. **Doc-level nits captured here (no code change).** (a) the ADR-0030 kill criterion enumerates non-interceptable vectors
   (inlined runtime, Worker/`importScripts`) but not **string-injection** (`innerHTML`/`insertAdjacentHTML`/`document.write`);
   sound for THIS site (its Trusted-Types + `strict-dynamic` CSP structurally blocks those), but a non-TT adopter whose
   container string-injects a runtime would escape the node-insertion surface — a known boundary for the generic-adopter
   claim. (b) `evaluateCandidate` runs on every page-wide DOM insertion for the page lifetime; the guard is cheap
   (nodeType/tagName) and the compile-once fix removed the per-call recompile, but the patch's own per-insertion overhead is
   not measured by the rig. (c) `append`/`prepend` are patched on `Element.prototype` only (not `Document`/`DocumentFragment`
   prototypes) — consistent with the DocumentFragment-non-walk residual below.
6. **Deferred edges (tracked in `docs/refinement-todo.md`).** A `<script>` inside a `DocumentFragment` batch-inserted is not
   walked; the single module-level `state` means no two concurrent independent suppressor configs. Both have resolution
   triggers; neither is required by any AC or present in the reference adopter.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `updated` | The served-tree enumeration omitted `tag-suppressor.js` (this slice's AC6 dist sibling) — and pre-existingly `reserve-personalization.js`; updated to list both + point at `DIST_ARTIFACTS` (`publish-dist.mjs`) as the authoritative set, so a future dist-sibling addition has one home (reconciliation-review recommendation). |
| `docs/specs/README.md` | `updated` at DONE | Regenerated by `workflow.py status-board` at the DONE close-out (the lifecycle step after RECONCILED). |
| `docs/product-vision.md` | `no-op` | No behavior/scope drift; adoption tooling for the already-scoped MVP9 rewire (`use_cases: []`). |
| `docs/architecture.md` | `updated` | Added the `adapters/eds/tag-suppressor.js` primitive to the `adapters/eds/` boundary description (a NEW adopter-facing public surface — the matcher/carve-out/diagnostic contract, ADR-0030), so the front-door module map isn't stale. No new ADR (ADR-0030 already accepted). |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 049 not closed (049-02 in flight) — no compress-on-close entry; 049 is not in the active-specs primer. |
| `docs/inbox.md` | `no-op` | Nothing to park. |
| `docs/refinement-todo.md` | `updated` | The two deferred edges (DocumentFragment non-walk; single-instance install state) logged with resolution triggers during implementation. |
| `docs/memory/**` | `deferred` | Spec-close memory-sync (the suppressor primitive + the insertion-surface interception technique) runs at 049-02's DONE close-out, not per-slice. |
| `docs/decisions/README.md` / ADR index | `no-op` | No new ADR (ADR-0030 already accepted + indexed). |
