---
status: DONE
dependencies: [022-01]
last_verified: 2026-09-01
frame_review: false
---

## Slice 022-02 — error checkpoints + sampling-rate fidelity

> Reshaped 2026-09-01 (maintainer "do the split"): the CWV/interaction checkpoints moved to **022-04** (they
> need a new runtime capture — 022-01's grounding showed the enhancer can't host in a chamber). This slice is
> the **no-new-capture** remainder: the `error` checkpoints + full sampling-rate fidelity.

**Goal:** Extend the DONE 022-01 `helix-rum` connector to cover every **non-CWV** `sampleRUM` checkpoint — the
`error` checkpoints and the full sampling-rate config — so the only thing standing between airlock and a
complete `sampleRUM` stand-in is CWV (022-04). Each rides the **same** 022-01 confined, not-consent-gated
governed path; no new capture machinery.

**DoR:**
- ✅ 022-01 DONE: the `helix-rum` connector (`connectors/helix-rum/{connector,map}.js`), its governed path
  (endpoint-ceiling + no-egress-purposes → confined, not consent-gated), the `top` checkpoint, and
  sampling state (`id`/`isSelected`/`weight`) fixed once at construction. **Grounded** (in-repo).
- ✅ The `error` checkpoint surface is grounded — `probes/eds-testbed/scripts/aem.js:68-92`: three window
  listeners (`error`, `unhandledrejection`, `securitypolicyviolation`) each call `sampleRUM('error', errData)`
  where `errData = { source, target }` (`source` = the first `https?://` stack frame, `target` = the error
  string). **Grounded** (read 2026-08-31).
- ✅ The sampling-rate table is grounded — `aem.js:23-34`: `on`=1 / `high`=10 / `medium`=100 (default) /
  `low`=1000 / `off`=0, resolved from a rate source (URL param / `SAMPLE_PAGEVIEWS_AT_RATE` / script dataset).

**Acceptance Criteria:**

1. **The `error` checkpoints ride the governed path.** The connector's `events` widens `["top"]` →
   `["top","error"]`; a captured `error` checkpoint maps to the grounded RUM body `{ weight, id, referer,
   checkpoint:"error", t, ...errData }` where `errData = { source, target }` matches `sampleRUM`'s own
   `dataFromErrorObj` shape (`aem.js:49-66`). It egresses via the **same** confined, not-consent-gated
   022-01 path (endpoint ceiling; no consent gate). The three main-thread capture points (window `error` /
   `unhandledrejection` / `securitypolicyviolation`) are the host's `push({event:"error", ...})` calls (the
   capture wiring itself is the deferred production-adapter question 022-01 flagged — this slice proves the
   connector maps + governs them, at the connector+seam fidelity 022-01 established).
   **Payload-hygiene note (named, not hidden):** `errData.target` is `error.toString()` — a faithful
   reproduction of what `sampleRUM` already sends; if an app throws an error whose message embeds user input,
   that rides today via the page's own `sampleRUM` identically. airlock reproduces the grounded shape (no
   *additional* fields); tightening `error.toString()` itself is a `sampleRUM`-inherent question, out of scope
   here — recorded as a known boundary.
2. **Sampling-rate fidelity.** The connector accepts a host-supplied rate (the `on/high/medium/low/off` names
   → `1/10/100/1000/0`, default `medium`=100) — mirroring `aem.js`'s table — and `isSelected` honors it.
   Observable: a given rate → the correct `weight` in the beacon URL + body; an **unselected** page-load emits
   **nothing** for **every** checkpoint (`top` and `error` alike — `isSelected` is decided once, per 022-01),
   not just the first.
3. **No regression + uniform governance.** 022-01's `top` path is byte-unchanged; the `error` checkpoints use
   the identical endpoint-ceiling + no-consent-gate governance (a re-pointed `error` beacon is held exactly
   like a re-pointed `top`); `id`/`weight` are shared across a page's `top` + `error` (one per-page identity).

**DoD:**
- [x] ACs pass. Tests (targeted — suite hangs): `error` checkpoint maps to the grounded shape + rides the
      governed path; rate-name → weight resolution; unselected → silent for `top` AND `error`; a re-pointed
      `error` beacon held; no-regression to `top`. Sweep: `helix-rum-*`, `endpoint-ceiling-seam`.
- [x] Reviews: compliance + craft + reconciliation (frame_review:false — a grounded extension of 022-01's
      pattern, no new load-bearing unknown).
- [x] Deviation log + reconciliation sweep; `mvp4.md` row updated (`error` + sampling done; CWV = 022-04).
- [x] **No live identifiers committed** (synthetic error/stack data + ids only).

**Anti-horizontal-phasing check:** airlock now governs the full **non-CWV** RUM surface (errors included) at
the same confined, not-consent-gated class — an observable widening of what crosses the seal, riding the
022-01 vertical. CWV (the remaining surface) is 022-04; the cutover (022-03) waits for both.

### Deviation log

- **Design point resolved (AC1 "how the error data rides the descriptor"): `event.params || event.payload`
  — no new descriptor convention.** `core/airlock.js`'s `push({ event, ...params })` produces the internal
  `{ type, params }` descriptor (`contracts/push-api.md`); the pinned `AirlockEvent` contract shape
  (`contracts/connector.d.ts`) carries the same per-event data as `payload`. `connectors/ga4/connector.js`'s
  `handle` and `connectors/alloy/connector.js`'s `toXdm` already bridge both shapes with
  `event.params || event.payload` — `map.js`'s new `errorFields(event)` helper uses the IDENTICAL bridge, so
  a captured `error` checkpoint is expected to arrive as `push({ event: "error", source, target })` (→
  `{ type: "error", params: { source, target } }`) from whatever production adapter eventually wires the
  three window listeners — the SAME deferred production-adapter question 022-01 flagged for `top`, not a new
  one. Not a genuine fork requiring escalation: the convention was already established by two prior
  connectors, so this slice conforms rather than invents.
- **`mapToRum` WHITELISTS `source`/`target` rather than spreading `event.params` wholesale.** `sampleRUM`'s
  own `sendPing` spreads `...pingData` unconstrained; this connector instead picks exactly the two grounded
  `dataFromErrorObj` fields (`aem.js:49-66`) off the per-event data. This is a deliberate payload-hygiene
  choice (not just style): it preserves 022-01's "hygiene by construction" property for the new checkpoint —
  an `error` body can never grow an 8th, caller-injected field, even if a future/misbehaving caller pushes
  extra params on an `error` event. Named per the slice's own payload-hygiene note (AC1), not silently assumed.
- **Sampling-rate precedence, pinned by a test (a genuine but low-stakes fork, decided here — not escalated):
  an explicit numeric `weight` WINS over a `rate` name when both are given.** `aem.js` itself gives no
  guidance (it has only ONE input knob, the rate name — `weight` is purely derived there); airlock now has
  two (the new `rate` name + 022-01's existing raw `weight` escape hatch). Resolved so the raw, already-
  resolved, more-specific value never gets silently clobbered by a friendlier name — consistent with
  `weight` having been the test/advanced-use escape hatch since 022-01. Pinned by
  `test/helix-rum-connector.test.js`'s "an explicit numeric weight OVERRIDES a rate name" test so the choice
  is grounded in an assertion, not just prose. `resolveWeight` (new, `map.js`) is the single place this
  precedence lives; an unrecognized/omitted `rate` falls back to the grounded default (`medium`/100),
  mirroring `aem.js`'s own `rateValue !== undefined ? rateValue : 100` fallback.
- **`DEFAULT_WEIGHT`'s definition moved to derive from `map.js`'s new `RATE_WEIGHTS.medium`** (was a bare
  `100` literal in `connector.js`) — same export name, same location (`connector.js`), same value; only the
  source of truth changed, to avoid a second hardcoded `100` once the rate table existed. Zero behavior
  change; both existing test files already import `DEFAULT_WEIGHT` from `connector.js` and pass unmodified.
- **No window-listener capture wiring added (same deferred scope 022-01 recorded for `top`).** This slice's
  own brief frames the three main-thread capture points (`error`/`unhandledrejection`/
  `securitypolicyviolation`) as "the host's `push({event:"error", ...})` calls... the capture wiring itself
  is the deferred production-adapter question 022-01 flagged." Consistent with that: this slice proves the
  connector MAPS + GOVERNS an `error` checkpoint (at 022-01's established connector+seam fidelity); it does
  not add `window.addEventListener` calls anywhere, and does not touch `adapters/eds/index.js`. The open fork
  022-01's deviation log already carries forward (production/adapter wiring, no dedicated
  `helix-rum-chamber.worker.js` yet) is unchanged by this slice — not a new gap, the same one, now also
  covering `error`.
- **Tests (targeted, per this slice's brief — full `vitest run` hangs on a stale worktree):**
  - `npx vitest run test/helix-rum-connector.test.js test/helix-rum-seam.test.js test/endpoint-ceiling-seam.test.js`
    → **45/45 passed** (31 + 8 + 6). New coverage: the widened `events:["top","error"]` manifest; the
    grounded 7-field `error` body (5 base + `source`/`target`) via BOTH `event.params` and `event.payload`;
    the `error` checkpoint posting to the SAME confined endpoint as `top` (no fan-out); the full rate-name →
    weight table (`on`/`high`/`medium`/`low`/`off`, table-driven `it.each`, asserted against the grounded
    values literally rather than importing the connector's own table); an unrecognized rate name falling back
    to the default; the explicit-`weight`-wins-over-`rate` precedence; `rate:"off"` never selecting; `id`/
    `weight` identical across a page's `top` + `error`; an unselected page silent for BOTH checkpoints from
    ONE connector instance; an `error` beacon dispatching with no consent gate (mirrors `top`'s seam test); a
    re-pointed `error` beacon held at the ceiling with no beacon-body leak in the diagnostic.
  - Regression: `npx vitest run test/consent-seal.test.js test/egress-confinement.test.js
    test/ga4-connector.test.js test/alloy-connector.test.js` → **43/43 passed** (15 + 9 + 10 + 9), unchanged —
    no `core/` file touched (this slice is additive-only: `connectors/helix-rum/{connector,map}.js` extended,
    two existing test files extended, this doc + `mvp4.md` updated).
  - `npm run lint` → clean (repo's flat-config `recommended` ruleset).
- **Files changed:** `connectors/helix-rum/connector.js` (widened `events`, `rate`/`weight` resolution wired
  in, doc comments updated — no change to `handle()`'s body); `connectors/helix-rum/map.js` (new
  `RATE_WEIGHTS`/`resolveWeight`/`errorFields`, `mapToRum` branches on `event.type === "error"`, `top`'s
  branch unchanged); `test/helix-rum-connector.test.js` (updated manifest-events assertion + new `error`/
  rate-fidelity/shared-identity describe blocks); `test/helix-rum-seam.test.js` (two new seam tests: no-
  consent-gate + ceiling-held, both for `error`); `docs/releases/mvp4.md` (new 022-02 row); this slice file
  (this Deviation log + Reconciliation sweep + DoD ticks).
- **No live identifiers:** every id/source/target/URL in the new tests is synthetic (`spike.example`,
  `evil.example`, `synthetic-error-id-9`, `synthetic-target-error-string`) or the AEM-public default
  (`ot.aem.live`); no real RUM ids, stack traces, or customer RUM base URLs are committed.

### Reconciliation sweep

- **Additive-only, no `core/` touched.** `git diff --stat` for this slice shows only
  `connectors/helix-rum/{connector,map}.js`, the two `test/helix-rum-*.test.js` files, this slice doc, and
  `docs/releases/mvp4.md` — independently confirmed by re-running the full regression sweep above (88/88
  green across the targeted + regression sets) with zero `core/` diff.
- **`top` is genuinely byte-unchanged, verified by reading `map.js`'s new `mapToRum`, not assumed:** the
  function still returns the SAME 5-key object literal for any non-`error` `event.type`; the `error` branch is
  an additive `{ ...body, ...errorFields(event) }` that only executes when `event.type === "error"`. All of
  022-01's original tests (the 5-field shape, the ephemeral id, the URL, `t` sourced from `event.ts`, at-
  most-one-request, sampling honored/decided-once, the hosted-via-createConnectorHost pair) pass UNMODIFIED
  except the one manifest-events assertion, which is an intentional, spec-mandated widening (AC1), not a
  regression.
- **Governance uniformity verified, not asserted on faith:** the `error` seam tests reuse the SAME
  `endpoint`/ceiling/consent machinery as `top`'s existing seam tests (same `FakeWorker` harness, same
  `createAirlock` call shape) — there is no `if (checkpoint === "error")` branch anywhere in `core/` or in
  the connector's egress path; `handle()` itself is untouched (only `mapToRum`'s BODY shaping branches, the
  governed dispatch path does not). The ceiling-held test's evil body is a hand-built JSON string (not
  produced by the connector), proving the ceiling holds on URL alone, independent of checkpoint content.
- **One identity confirmed structurally, not just by the passing test:** `id`/`weight`/`isSelected` are all
  computed ONCE in `createHelixRumConnector`'s closure (unchanged from 022-01) and `handle()` reads them by
  closure reference on every call — there is no per-checkpoint re-derivation path to audit away.
- **mvp4.md** `helix-rum` row gets a new `022-02 DELIVERED` line (the `022-01 DELIVERED` line is left intact,
  matching the precedent 022-01 itself set of annotating incrementally rather than rewriting history).
- **Open fork carried forward (not orphaned, not duplicated):** production/adapter wiring (the window-
  listener capture calls, a RUM-dedicated `createAirlock` instance) stays in 022-01's deviation log as the
  single place it's tracked; this slice's own log cross-references it rather than re-opening a second copy.
  Likely lands with 022-03 (the page-side cutover) or whenever an `error`-capturing production adapter is
  built.
- **No orphaned refs:** `connector.js`'s header doc's stale "The enhancer decision itself is deferred to
  022-02" (accurate when 022-01 was written, stale after the spec's 2026-09-01 reshape moved that decision to
  022-04) was caught and corrected while touching this file, rather than left to compound.
- **eslint clean** under the 021-03 flat config; no new file, no glob change needed (the two touched
  connector files already matched `connectors/**/*.js`).
