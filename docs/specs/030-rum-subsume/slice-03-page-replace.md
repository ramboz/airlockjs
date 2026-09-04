---
status: DONE
dependencies: [030-02]
last_verified: 2026-09-03
---

<!-- jig grounding (ADR-0020): sampleRUM is inline in probes/eds-testbed/scripts/aem.js
     (~:14, auto-fires `top` on load :128 via navigator.sendBeacon). The double-count is
     the honest boundary 022-01 AC3 named. "Replace" = neutralize inline sampleRUM + boot
     airlock's RUM. -->

## Slice 030-03 — the page-side replace + no double-count

**Goal:** Demonstrate the **replace** end-to-end on `probes/eds-testbed`: neutralize the inline `sampleRUM` and
boot airlock's RUM (030-01's `bootHelixRum`) as the **single** governed RUM authority, with a rig proving
**exactly one** governed beacon per checkpoint (no double-count) — the observable "sampleRUM off, airlock owns
RUM".

**DoR:**
- ✅ 030-02 DONE (bootHelixRum + the governed RUM instance exist to boot on the page).
- ✅ Grounded: inline `sampleRUM` lives in `probes/eds-testbed/scripts/aem.js` — `init()` (aem.js:666) runs at
  module-import time and fires `sampleRUM.sendPing('top', …)` (aem.js:128) via **`navigator.sendBeacon`** to
  `ot.aem.live/.rum/<weight>`; error auto-pings share `sendPing`. The testbed loads `aem.js` then `scripts.js`
  (head.html), and boots airlock via `await import('…/airlock/eds.js')` (scripts.js:220). Neutralization = the
  integrator's `aem.js` edit (022's scoping). **Transport distinguishes the two authorities:** sampleRUM egresses
  via `navigator.sendBeacon`; airlock egresses via `fetch` — so a rig can attribute each beacon by transport.

**Acceptance Criteria:**

1. **Opt-in replace, default-off.** A `?rum=airlock` param (read by a nonce'd inline flag in `head.html`, set
   BEFORE `aem.js` loads → `window.__airlockOwnsRum`) (a) neutralizes inline `sampleRUM`'s egress — `aem.js`'s
   `sampleRUM.sendPing` becomes a no-op under the flag, so NO `navigator.sendBeacon` `.rum` fires — and (b) makes
   `scripts.js` boot `bootHelixRum({ forceSelect: true })` as the RUM authority. WITHOUT the param the testbed is
   **behaviorally inert / default-off** (the added inline flag is a no-op, `sampleRUM.sendPing` runs normally, no
   airlock RUM boots) — zero impact on existing rigs (confirmed: `rig/e2e.mjs` green).
2. **A real-browser rig proves exactly one governed beacon per checkpoint, attributed by transport.** `rig/rum-replace.mjs`
   (mirrors `rig/e2e.mjs`: `npm run build` → serve `probes/eds-testbed/` under the boilerplate CSP → chromium)
   instruments `navigator.sendBeacon` + `window.fetch` (via `addInitScript`, before page scripts) to record every
   `.rum` beacon as `{ via, checkpoint }`, and network-stubs `ot.aem.live` (hermetic, no live egress). Loading
   `index.html?rum=airlock` asserts: **`top`** — zero `sendBeacon` `.rum`, **exactly one** `fetch` `.rum` with
   `checkpoint:"top"` to `ot.aem.live` (the airlock beacon replaced sampleRUM's, no double-count); **`error`** — a
   dispatched page error yields exactly one governed `fetch` error beacon, zero sampleRUM. A **control** load
   (no param) asserts the inverse: the inline `sendBeacon` `top` fires and no airlock `fetch` `.rum` appears.
3. **Scope boundary is explicit + honest.** The rig proves the AEM pipeline still receives the **core** checkpoints
   (`top`/`error`), now governed via airlock — NOT that the rum-enhancer's interaction/lifecycle set is reproduced
   (out of scope; the enhancer isn't loaded on the testbed — `RUM_MANUAL_ENHANCE`). The `cwv`/INP-at-page-hide
   mechanism is proven deterministically by the 030-02 unit test (`test/eds-helix-rum.test.js`); the rig asserts
   the load-time `cwv` (LCP) governed beacon **best-effort** (non-gating — attribution only), so a headless
   timing flake never reds the verdict.
4. **No live identifiers**; `ot.aem.live` is network-stubbed in the rig; the per-page id is airlock's synthetic
   ephemeral `crypto.randomUUID` slice; `forceSelect` is a testbed-only demonstration seam.

**DoD:**
- [x] All ACs pass; the page-side edits are param-gated (default testbed **behaviorally inert** — existing rigs unaffected, `rig/e2e.mjs` green).
- [x] `rig/rum-replace.mjs` green: exactly-one-per-checkpoint (top strict `===1`; error strict delta `===1` per dispatched error) attributed by transport + the control inverse.
- [x] `npm run build` still emits the five worker siblings; `bootHelixRum` reachable from the served `eds.js`.
- [x] Full targeted suite green (eds-helix-rum / rum-unload-dispatcher / eds-boot / helix-rum-seam — 41 tests; 030-03 touches zero unit-tested code).
- [x] Reviewed by independent reviewer; compliance + craft passes (PASS; two Medium hardening points applied). Implementation review passed.
- [x] Deviation log + Reconciliation sweep produced below; reconciliation review recorded.

**Anti-horizontal-phasing check:** after this slice the testbed demonstrates airlock as the single governed RUM
authority (sampleRUM off, one beacon per checkpoint) — the observable replace.

### Deviation log (after reconciliation)

- **The working flag lives in `probes/eds-testbed/index.html`, not (only) `head.html`.** The testbed serves a
  standalone `index.html` that inlines its OWN `<head>` (it does not use `head.html` — that is the production EDS
  server-side-include template the static rig never serves). The `?rum=airlock` inline flag is therefore in
  `index.html` (what the rig loads); the identical `head.html` edit is kept as the **production-integrator
  reference** (a real EDS site's `head.html` IS server-side-included), honestly labeled as a mirror. AC1's "in
  `head.html`" is met in spirit by the served `index.html` + the production-template mirror.
- **"Behaviorally inert," not "byte-unchanged."** The default (no-param) testbed gains an inert inline flag
  `<script>` (a no-op without `?rum=airlock`); it is behaviorally unchanged (inline sampleRUM fires, no airlock
  RUM), not literally byte-identical. AC1/DoD reworded accordingly. Existing rigs unaffected — `rig/e2e.mjs` green.
- **Rig `error` assertion tightened to a strict delta (`===1`), post-review.** The implementation review flagged
  the original `>= 1` as weaker than AC2's "exactly one." Now the rig snapshots the error-beacon count before the
  synthetic dispatch and asserts the delta is exactly 1 — "exactly one governed beacon PER dispatched error,"
  robust to any page-load error-event noise. The RUM top-wait was also decoupled from the unrelated GA4
  `__airlockBootFailed` flag (keyed off `__airlockRumBootFailed` only).

### Reconciliation sweep

- **All 4 ACs met; `rig/rum-replace.mjs` green (7/7 checks).** Replace (`?rum=airlock`): zero inline sampleRUM
  `sendBeacon`, **exactly one** airlock `fetch` `top` (strict `===1` — no double-count), **exactly one** governed
  `fetch` `error` per dispatched error (strict delta), all confined to `ot.aem.live`. Control (no param): inline
  `sendBeacon` `top` fires, zero airlock `fetch` `.rum` — the inverse. Transport attribution is grounded:
  airlock egresses via `fetch` (`core/airlock.js:300` steady-state, `core/egress.js:80` critical) and DENIES
  `sendBeacon` in its worker (`core/egress-confinement.js`); inline sampleRUM egresses via `navigator.sendBeacon`
  (`aem.js:124`).
- **Non-vacuous (two independent reds):** (a) before the `index.html` flag existed, the replace checks were RED
  (`replace_zero_inline_sampleRUM` + `replace_exactly_one_airlock_top` false); (b) disabling the `aem.js`
  neutralization guard reds `replace_zero_inline_sampleRUM` (the double-count reappears). Both restored to green.
- **Default-path regression clean:** `rig/e2e.mjs` PASS (GA4 worker-cycle + pushCritical fast path + identity,
  under the boilerplate CSP) — the param-gated edits do not touch the default page path. Unit suite unaffected
  (030-03 changed only `probes/` + `rig/` + docs — nothing the vitest tests import).
- **Scope boundary (honest, per AC3):** the rig gates on `top` + `error` (the core checkpoints, deterministic).
  The `cwv`/INP-at-page-hide mechanism is proven deterministically by the 030-02 unit test
  (`test/eds-helix-rum.test.js`); the rig's `cwv` capture is best-effort / non-gating (a headless LCP-timing
  flake never reds the verdict — observed `cwv_best_effort: 0` in the CI-shaped run). The rum-enhancer's
  interaction/lifecycle checkpoint set is explicitly NOT reproduced (`RUM_MANUAL_ENHANCE`; out of scope — the
  formal boundary lands in 030-04).
- **No live identifiers:** `ot.aem.live` is network-stubbed (`page.route` → 204); airlock's per-page id is the
  synthetic ephemeral `crypto.randomUUID().slice(-9)`; `forceSelect` (replace) and the pre-seeded
  `isSelected` (control) are testbed-only determinism seams.
