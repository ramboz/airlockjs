---
status: DONE
dependencies: [049-01]
last_verified: 2026-09-15
arch_review: true
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section — never assert an
     unverified claim as fact. -->

## Slice 049-02 — direct-beacon-transport suppression (egress-parity completeness)

**Goal:** Extend 049-01's suppressor to block a container's **direct beacon** — a bare pixel / `sendBeacon` fired WITHOUT a
heavy runtime (which 049-01's runtime-`<script>` block does not catch) — while STRUCTURALLY exempting airlock's OWN
reproduction of that beacon. The discriminator is **transport-of-emission, NOT URL**: airlock reproduces a vendor's beacon
at the container's **byte-identical** URL (Meta `/tr`, gtag `/g/collect`) by design, so a URL/query matcher alone cannot
separate airlock's copy from the container's. But airlock emits EVERY own main-thread beacon via `fetch(url, { keepalive:
true })` (grounded below) and NEVER via `<img>`/`sendBeacon`/`XHR` — so the suppressor suppresses a matching beacon on the
**container's** transports (`<img>`/`sendBeacon`/`XHR`/**non-keepalive** `fetch`) and exempts airlock's `fetch`+`keepalive`
signature. This makes airlock's arm the sole emitter for the pixel-style, direct-beacon generic-adopter case.

**Why `arch_review: true` (revised — frame-critique 2026-09-15).** The carve-out contract gains a **transport-of-emission**
dimension beyond 049-01's URL-only allow-set: exempt `fetch`+`{keepalive:true}` (airlock's exact egress signature); suppress
`<img>`/`sendBeacon`/`XHR`/non-keepalive `fetch`. That is a change to the suppressor's public carve-out semantics — the
frame-critique showed a pure URL matcher CANNOT reconcile "suppress the container's `/tr`" with "emit airlock's `/tr`" when
both are the same URL — so it warrants the arch pass (049-02's original "no new surface" rationale was wrong).

**DoR:**
- ✅ 049-01 DONE — the matcher shape, the URL allow-set carve-out, the flat diagnostic, and the dist entry exist; this slice
  binds the beacon transports and adds the transport-of-emission carve-out.
- ✅ The Playwright real-browser rig (`rig/tag-suppressor.mjs`) exists — extend it with the transport cases.
- ✅ Grounded: airlock's egress signature is `fetch`+`keepalive` (A-transport); airlock reproduces the vendor URL identically
  (A-collision).

**Acceptance Criteria:**

1. **The container's direct-beacon transports are suppressed on a URL match.** With the suppressor installed, a
   `suppress`-matching beacon sent via `new Image().src=` / `img.setAttribute('src', …)` (the full image-src surface, incl.
   `srcset` — the same full-surface lesson A1 taught for `<script>`), `navigator.sendBeacon()`, `XMLHttpRequest`, or a
   **non-keepalive** `fetch()` is **dropped** (no network request); a non-matching beacon on any transport goes through.
   Proven in the real-browser rig (network-0 per transport), Node/vitest-ineligible.
2. **airlock's OWN egress is exempt by its transport signature (the load-bearing carve-out).** Because airlock emits EVERY
   main-thread beacon via `fetch(url, { keepalive: true })` (A-transport), the beacon-block EXEMPTS a `fetch` whose
   `init.keepalive === true` even at a URL that matches a `suppress` matcher — that is airlock's own reproduction (Meta
   `/tr`, gtag `/g/collect` are byte-identical to the container's). A container beacon at that SAME URL via
   `<img>`/`sendBeacon`/`XHR`/non-keepalive `fetch` IS suppressed. **Mutation-tested on the one collision transport
   (`fetch`):** remove the keepalive exemption → airlock's own keepalive-fetch beacon to a matching URL is dropped → red.
   (The URL allow-set from 049-01 still provides an explicit keep on any transport, additive to this signature exemption.)
3. **The pixel-without-a-runtime case, end-to-end, at the container's own URL.** A container template that fires a bare
   `<img>`/`sendBeacon` beacon directly at the SAME URL airlock reproduces (no blockable runtime — the case 049-01 misses)
   is suppressed via its `<img>`/`sendBeacon` transport, WHILE airlock's `keepalive`-fetch reproduction of that identical URL
   still egresses — the sole-emitter parity the URL-only carve-out could not achieve. The flat 028 diagnostic (049-01) names
   the matched URL + the suppressed transport.
4. **Idempotent / order-safe / composes with 049-01.** The transport patches install once (no double-wrap on re-install)
   and compose with the runtime-`<script>` block from ONE `installTagSuppressor` call — a single config covers runtimes AND
   beacons. `uninstall` restores the saved native transports too.

**DoD:**
- [x] All ACs pass; full test suite green (no regressions). — 1918/1918 (121 files), 2026-09-15.
- [x] Implementer test coverage exercises each AC; the transport-signature carve-out (AC2, mutation-tested on `fetch`) and
      the bare-pixel-at-airlock's-URL case (AC3) are explicit; AC1 is the GATING real-browser rig extension (network-0 per
      transport), wired into CI's browser-oracle job.
- [x] Each new test shown to fail when its feature is removed (mutate → red → restore) — especially the `fetch`+`keepalive`
      exemption (remove it → airlock's own beacon dropped → red) and the per-transport network-0 assertions.
- [x] Reviewed by `reviewer` subagent (compliance) + craft pass + **arch pass** (`arch_review: true` — the transport-of-
      emission carve-out contract). — verdicts recorded under `reviews/slice-02-{compliance,craft,arch}.md` (all pass).
- [x] Deviation log + reconciliation sweep produced under this slice heading. If this closes spec 049 (049-01 + 049-02 DONE),
      run the close-out (compress the primer's active-spec entry; memory-sync the suppressor primitive + the transport
      asymmetry).
- [x] `docs/refinement-todo.md` updated with the residuals (A-residual: the non-four escape vectors + the same-URL
      keepalive-fetch-vs-airlock collision).

**Anti-horizontal-phasing check:** after this slice lands, an EDS adopter's suppressor also drops a container's **bare
pixels / direct beacons** at the exact URL airlock reproduces — via the container's own transport — while airlock's
`keepalive`-fetch arm still emits, so airlock is the sole emitter for beacon parity even for a URL-identical reproduction. A
usable capability, not intermediate state.

## Assumptions

- **A-transport (grounded) — airlock emits EVERY own main-thread beacon via `fetch(url, { keepalive: true })`, NEVER
  `<img>`/`sendBeacon`/`XHR`.** `core/egress.js`'s `fetchInit` (`:52-53`): GET → `{ method:"GET", keepalive:true }`,
  POST → `{ method:"POST", body, keepalive:true }`; `core/airlock.js:432,840` dispatch every mapped request via
  `fetch(req.url, fetchInit(...))`, and the pixel arm's `/tr` is a `fetch` GET (`connectors/pixel/connector.js:149`). A grep
  confirms no `new Image`/`sendBeacon`/`XMLHttpRequest` in airlock's own main-thread code (the sole `sendBeacon` token is a
  comment at `adapters/eds/index.js:1721`). So `keepalive:true` on a `fetch` is airlock's exact egress signature — the basis
  for the transport-of-emission carve-out.
- **A-collision (grounded — WHY a URL matcher is insufficient at the beacon level).** airlock reproduces a vendor's beacon at
  the container's byte-identical URL: Meta `/tr` (`connectors/pixel/vendors/meta.js` `META_TR_ENDPOINT` = `facebook.com/tr`)
  and gtag `/g/collect` (`connectors/ga4/gtag.js`). So a URL/query matcher alone cannot separate airlock's copy from the
  container's — an `allow` protecting airlock's `/tr` also protects the container's; a `suppress` dropping the container's
  also drops airlock's. Only 049-01's `/mp/collect`-vs-`/g/collect` runtime split (different paths) was URL-separable;
  same-path beacon reproduction is not. Transport-of-emission is the discriminator. (Frame-critique 2026-09-15.)
- **A-residual — escape vectors + the same-URL keepalive-fetch collision are scoped, not covered.** A container beacon via
  WebSocket/EventSource, `<iframe src>`/`<object>`, CSS `url()`, `<link rel=prefetch|dns-prefetch>`, or from inside a Worker
  escapes the four patched transports (the ADR-0030 kill-criterion class). And a container beacon sent via
  `fetch({keepalive:true})` at the EXACT same URL as an airlock-migrated vendor is indistinguishable from airlock's own →
  NOT suppressed (fails toward keeping airlock's arm — the safe direction, never dropping airlock's data). Both logged in
  `refinement-todo.md` with resolution triggers. The same-URL keepalive-fetch collision **cannot bite the actual MVP9 trial**:
  all four trial vendors are runtime-based, so their `fetch`-shaped beacons in `martech.golden.json` are runtime-*emitted*
  (already killed by 049-01, never a runtime-less direct keepalive-fetch); the collision only concerns a hypothetical generic
  bare-pixel adopter that fires a keepalive-fetch beacon at an airlock-reproduced URL — none exists on the reference site.

### Deviation log (after reconciliation)

**Review gate (2026-09-15) — slice 049-02, four gated passes.**

- **Frame-critique (pre-implementation): PASS** (`reviews/slice-02-frame-critique.md`) — after a REVISE that redesigned
  the airlock-egress carve-out from URL-based to **transport-of-emission** (a URL matcher cannot separate airlock's
  byte-identical `/tr`/`/g/collect` reproduction from the container's).
- **Compliance (jig:reviewer): needs-changes → PASS on re-review** (`reviews/slice-02-compliance.md`). First pass
  flagged a real AC4 coverage hole: (a) the "idempotent install" unit test was **vacuous** (the no-DOM vitest substrate
  early-returns before any patching runs), and (b) `uninstall`'s beacon-transport restoration + the
  no-double-wrap-on-reinstall guarantee had **zero executing coverage**. Closed in the rig (NOT logged as a
  source-inspected deviation — the 049-01 precedent would have permitted logging, but the gap was cheaply closable and
  is the same vacuous-coverage class 049-01 closed rather than logged):
  - Added an AC4 phase to `rig/tag-suppressor-harness.html`: capture true-native transport refs before first install,
    retain the `uninstall` handle, **re-install** (idempotency), call `uninstall()` once, then re-drive matching beacons.
  - **Discriminator correction (material deviation from the fix's literal design).** The originally-prescribed proof —
    "after uninstall, assert the re-driven beacon reaches the network" — is itself **vacuous**, verified empirically:
    `uninstall()` clears the shared live `state.compiledSuppress`, so a leftover wrapper over cleared state passes a
    beacon through *identically* to a true native (the unpatch-deletion mutation left the network assertions green).
    Replaced with **7 identity assertions** (`proto[name] === trueNative`, captured pre-install) that go red under BOTH
    the AC4b unpatch-deletion mutation and the AC4a double-guard-removal mutation. The network-reachability assertions
    are retained as non-discriminating end-to-end sanity.
  - Re-scoped the vacuous unit test to assert only the no-DOM early-return safety it genuinely exercises.
- **Craft (pr-review): PASS** (`reviews/slice-02-craft.md`). Three nits folded: (1) added a `setAttribute("srcset", …)`
  fixture closing the last unexercised `isImgSrcAttr` branch (mutation-red on removing the `srcset` branch);
  (2) refreshed the test-file header to cover 049-02; (3) added "AC1" to the CI gating-step label.
- **Arch (arch-review): PASS** (`reviews/slice-02-arch.md`; `arch_review: true`). No blockers; three accepted
  trade-offs LOGGED to `refinement-todo.md`, not fixed:
  1. **Page-global keepalive exemption** — the carve-out exempts EVERY `fetch({keepalive:true})` on the page, so the
     discriminator is really "keepalive-fetch is unsuppressable," coarser than "airlock's egress is exempt." Fails safe
     (never drops airlock's data). Confirmed intended.
  2. **Two-loaded-copies latent hazard** — if two module copies both install, the second's `patchMethod` no-ops on the
     first's marker (config silently inert) and its `uninstall()` restores the first copy's native. Extends the
     single-instance limitation; the single-import dist-sibling model avoids it.
  3. **Micro-perf** — the `fetch` wrapper resolves the input URL before the `keepalive` short-circuit, so airlock's own
     keepalive egress pays an unnecessary URL-resolution per beacon.
- **Compliance re-review, non-blocking (low severity, logged)** — the suppressed `XMLHttpRequest.send` returns without
  firing a completion event, unlike `sendBeacon` (returns `true`) / `fetch` (resolves `204`) which simulate success to
  avoid a caller falling back to another transport. XHR is defensive / not in the reference idiom, fails safe, and all
  four transports are suppressed for a matching URL anyway. Consistency residual in `refinement-todo.md`, not a defect.

**`arch_review` flip (ADR-0030 implementation record).** 049-02 was originally scoped `arch_review: false` ("no new
surface — binds the existing matcher to more transports"). The frame-critique showed a pure URL matcher CANNOT reconcile
"suppress the container's `/tr`" with "emit airlock's `/tr`" when both are byte-identical — forcing a
**transport-of-emission** carve-out dimension (exempt `fetch`+`keepalive`; suppress
`<img>`/`sendBeacon`/`XHR`/non-keepalive-fetch) beyond 049-01's URL-only allow-set. That is a change to the suppressor's
public carve-out semantics → flipped to `arch_review: true`; the arch pass ran and passed.
[ADR-0030](../../decisions/adr-0030-native-tag-suppressor.md)'s "airlock-egress carve-out" is now realized as
(URL/path/query allow-set) ∪ (fetch+keepalive signature exemption); no ADR amendment needed (ADR-0030 named the
airlock-egress carve-out as load-bearing — 049-02 specifies its mechanism).

### Reconciliation sweep

- **Changed paths (each covered substantively in the Deviation log above):** `adapters/eds/tag-suppressor.js` (the
  beacon-transport patch + AC4 uninstall/idempotency), `test/eds-tag-suppressor.test.js` (re-scoped no-DOM idempotency
  test + refreshed header), `rig/tag-suppressor.mjs` + `rig/tag-suppressor-harness.html` (the AC4 identity phase + the
  `setAttribute("srcset")` fixture), `.github/workflows/ci.yml` (gating-step label + AC1), `docs/refinement-todo.md`
  (five residuals), `docs/specs/049-native-tag-suppressor/spec.md` (the `arch_review` flip + the decomposition edit),
  this slice file (deviation log + sweep). `docs/architecture.md` — **no-op** (the 049-01 entry, `architecture.md:17`,
  already states "049-02 extends the same matchers to direct beacon transports").
- **Spec/slice alignment:** all four ACs met + proven in the gating rig (45/45 assertions). The DoD "mutate → red"
  bullet is satisfied for the keepalive exemption (pure unit + rig), the per-transport network-0, the AC4 identity
  discriminators (both mutation directions), and the srcset branch.
- **Residuals logged (`refinement-todo.md`):** the non-four beacon escape vectors
  (WebSocket/EventSource/`iframe`/`object`/CSS `url()`/`link` prefetch/Worker) and the same-URL
  keepalive-fetch-vs-airlock collision (both ADR-0030 kill-criterion class, with resolution triggers); NEW at
  reconciliation — the XHR-completion-event asymmetry, the two-loaded-copies note, and the fetch-wrapper
  URL-resolve-before-keepalive micro-perf.
- **No drift:** `docs/architecture.md` documents the suppressor home + the 049-02 beacon extension; the diagnostic
  stays flat (spec-028 collector invariant, `core/inspector/collector.js:53-60`); the vendor-neutrality machine-guard
  passes; `adapters/eds/tag-suppressor.js` is byte-identical to pre-fix (all review mutations restored).
- **Spec 049 closure:** 049-01 (DONE, landed `5bf475c`) + 049-02 (this) complete spec 049. Close-out: compress the
  primer's active-spec entry; memory-sync the suppressor primitive + the transport-of-emission asymmetry.
