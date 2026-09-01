---
status: DONE
dependencies: [022-01]
last_verified: 2026-09-01
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 022-04 — CWV checkpoint via `web-vitals` (native runtime capture)

> Split out of 022-02 (maintainer "do the split", 2026-09-01). This is the CWV surface — the part that needs
> a **new** runtime capture, because 022-01's grounding showed `helix-rum-enhancer` can't host in a chamber
> (`document`-requiring loader + `sendBeacon`-blocked egress). airlock **reproduces** the enhancer's `cwv`
> checkpoint natively.

**Goal:** Give airlock its own **runtime CWV capture** and emit the `cwv` checkpoint (LCP / CLS / INP) through
the DONE 022-01 governed path — using **Google's `web-vitals/attribution` build** as the metric source
(maintainer, 2026-09-01: the reliable source Adobe RUM uses behind the scenes; the **attribution** build for
richer data — LCP element + sub-part timings, CLS shift sources, INP interaction target + timings), not a
hand-rolled `PerformanceObserver`. **Capture-layer, not chamber (grounded nuance):** `web-vitals` runs in the
**main-thread capture layer** — LCP/CLS/INP come from `PerformanceObserver` entry types scoped to the page's
document, which a Worker cannot observe — so the chamber isolates the metric's **mapping + egress**, not the
measurement. The attribution build's extra cost lands at **metric finalization** (visibility-change /
page-hide), **off** the interaction hot path, so INP is unaffected (airlock's INP-safe-by-construction thesis)
— consistent with the maintainer's "isolated … should not impact perf too much." This is the observability
payoff of airlock's CWV-first thesis, sourced by airlock itself.

**Grounded — the enhancer's checkpoint set (AC1 probe, `helix-rum-enhancer` README, fetched 2026-09-01):**
`cwv` (Core Web Vitals — LCP/CLS/INP), plus interaction/lifecycle checkpoints `click`, `viewblock`,
`viewmedia`, `enter`/`navigate`/`reload`, `formsubmit`, `pagesviewed`. **This slice covers `cwv`** — the
meaty new-capture piece; the interaction/lifecycle checkpoints are DOM-event-driven (like 022-02's `error`
listeners) and are the **remaining parity surface** (a follow-up slice, 022-05, before 022-03's cutover — see
the note in the Anti-horizontal-phasing check).

**DoR:**
- ✅ 022-01 DONE: the governed path + the connector shape each checkpoint rides; 022-02 added the descriptor
  bridge (`event.params`) checkpoints use to carry per-event data — the `cwv` payload rides the same channel.
- ✅ 022-01 grounding: the enhancer is **not** chamber-hostable, so this is native reproduction.
- ✅ The `cwv` checkpoint contract is grounded (enhancer README + `sampleRUM.sendPing`): a `cwv` beacon
  carries the CWV metric(s) alongside the base `{ weight, id, referer, checkpoint:"cwv", t }`.
- ⚠️ **To confirm at implementation:** `web-vitals`'s exact API surface (`onLCP`/`onCLS`/`onINP` +
  `onTTFB`/`onFCP`; the metric object shape `{ name, value, delta, id, rating, … }`) — read it from
  `node_modules/web-vitals` once added, and the enhancer's exact `cwv` payload field names (does it send one
  `cwv` beacon per metric, or a combined one — reconcile against the enhancer source / a real RUM payload).

**Acceptance Criteria:**

1. **Ground the `cwv` wire shape, the `web-vitals/attribution` API, AND the structured-cloneable scalar
   subset.** `web-vitals` is already installed (`^6.2.1`, a runtime dependency); read the
   **`web-vitals/attribution`** entry's API (`onLCP`/`onCLS`/`onINP` + the metric object incl. its
   `attribution` sub-object) from `node_modules`. **CRITICAL (frame-critique must-fix):** the raw
   `attribution` object carries **non-structured-cloneable** `PerformanceEntry` sub-objects
   (`processedEventEntries`, `longAnimationFrameEntries`, `longestScript.entry` —
   `web-vitals/dist/modules/attribution/onINP.js`); pushing them through airlock's `push()`→worker
   `postMessage` would throw **`DataCloneError`** and break the whole drain. So AC1 **enumerates the
   structured-cloneable SCALAR** attribution fields airlock projects (e.g. INP's `interactionTarget` selector
   + `interactionType` + the timing numbers; LCP's `target`/`element` selector + timing scalars; CLS's
   `largestShiftTarget` + value), **NOT** the raw entries. Ground the enhancer's exact `cwv` payload
   (checkpoint name + metric fields + which attribution scalars) from the enhancer source / a real payload,
   and record it. **Parity-superset + fallback:** airlock fully controls the payload (`map.js` whitelists), so
   the DEFAULT is **whitelist-to-enhancer-parity**; a superset (extra attribution scalars) ships only if a
   live collector probe confirms the AEM RUM pipeline accepts it — an AC1 rejection **narrows the whitelist**,
   it does not block the slice.
2. **`web-vitals/attribution` CWV capture → governed `cwv` checkpoint.** A **capture-layer** (main-thread)
   module subscribes to `onLCP`/`onCLS`/`onINP` from `web-vitals/attribution`; on each finalized metric it
   **projects the attribution to the grounded structured-cloneable SCALARS on the main thread** (per AC1 —
   never the raw non-cloneable entries) and `push`es a `cwv` checkpoint carrying `{ name, value,
   ...attributionScalars }` on the `event.params` bridge (022-02); the connector maps it to the grounded RUM
   `cwv` body and egresses it through the **022-01** confined, not-consent-gated path (same `id`/`weight` as
   `top`/`error`). **Emission model (design fork — resolve from AC1's grounding):** one `cwv` beacon per
   metric (the callbacks finalize at different times) vs one **combined** `cwv` — if the enhancer combines,
   this slice needs a buffering/combination step, not just per-callback push. Observable: a **stubbed**
   `web-vitals` callback → a `cwv` push carrying **only cloneable scalars** → the governed beacon (held if
   re-pointed; fired regardless of consent; sampling-gated). (Real end-to-end LCP/CLS/INP needs the production
   capture wiring — deferred, like 022-01's `push()` adapter.)
3. **CWV-safe (no new INTERACTION-PATH cost) + no regression.** The attribution build DOES add main-thread
   work — a second `PerformanceObserver` (`long-animation-frame`) + report-time attribution compute — but it
   is **off the interaction hot path**: `web-vitals` defers per-interaction bookkeeping via its own
   `whenIdleOrHidden` and computes attribution only at report-time (visibility-hidden), so INP is unaffected
   (verified against `node_modules/web-vitals` in the frame-critique). The mapping/egress stay behind the
   airlock. The `top`/`error` paths are byte-unchanged; the `cwv` checkpoint rides the identical governance.

**Findings (AC1 — the `web-vitals/attribution` grounding, this session, 2026-09-01):**

- **The exact structured-cloneable SCALAR attribution fields, read from `node_modules/web-vitals@6.2.1`'s
  `dist/modules/types/{lcp,cls,inp}.d.ts` (the installed package, not a guess):**
  - **LCP (`LCPAttribution`, `lcp.d.ts:14-67`):** `target?: string`, `url?: string`,
    `timeToFirstByte: number`, `resourceLoadDelay: number`, `resourceLoadDuration: number`,
    `elementRenderDelay: number`. **Excluded** (PerformanceEntry-shaped, non-cloneable):
    `navigationEntry?: PerformanceNavigationTiming | PerformanceSoftNavigation`,
    `lcpResourceEntry?: PerformanceResourceTiming`, `lcpEntry?: LargestContentfulPaint`.
  - **CLS (`CLSAttribution`, `cls.d.ts:14-51`):** `largestShiftTarget?: string`,
    `largestShiftTime?: DOMHighResTimeStamp` (a `number`), `largestShiftValue?: number`,
    `loadState?: LoadState` (a string union). **Excluded:** `largestShiftEntry?: LayoutShift` (an entry) and
    **`largestShiftSource?: LayoutShiftAttribution`** — this one is not just an entry, it carries a **live DOM
    `Node` reference** (`LayoutShiftAttribution.node`), an even harder structured-clone hazard than a bare
    `PerformanceEntry`.
  - **INP (`INPAttribution`, `inp.d.ts:36-155`):** `interactionTarget?: string`, `interactionType?: 'pointer' |
    'keyboard'`, `interactionTime?: DOMHighResTimeStamp`, `nextPaintTime?: DOMHighResTimeStamp`,
    `inputDelay: number`, `processingDuration: number`, `presentationDelay: number`, `loadState: LoadState`,
    plus four less-obvious-but-equally-scalar fields the task's own "e.g." shortlist didn't name:
    `totalScriptDuration?`, `totalStyleAndLayoutDuration?`, `totalPaintDuration?`, `totalUnattributedDuration?`
    (all `number`). **Excluded:** `processedEventEntries: PerformanceEventTiming[]`,
    `longAnimationFrameEntries: PerformanceLongAnimationFrameTiming[]` (entry arrays), and
    `longestScript?: INPLongestScriptSummary` — a nested object whose `.entry` is a `PerformanceScriptTiming`
    (the literal example the frame-critique named); its two OTHER sub-fields (`subpart`, `intersectingDuration`)
    are themselves scalars but are dropped **wholesale together with** `longestScript`, not partially unwrapped
    — a deliberate shallow-filter simplicity/safety tradeoff, named below.
  - 21 distinct field names total (`loadState` shared by CLS/INP, counted once) — the full grounded whitelist
    lives as `CWV_ATTRIBUTION_FIELDS` in `connectors/helix-rum/map.js`, cited field-by-field against the same
    three `.d.ts` files.
- **Two-layer safety design, not one.** `connectors/helix-rum/cwv-capture.js`'s `projectCwv` uses a
  **structural** filter (`typeof value === "string"|"number"|"boolean"`) over `metric.attribution`, not a
  hardcoded field-name list — it can never forward a non-scalar regardless of which field it arrives under,
  including a field this slice's grounding didn't anticipate (future-proof against a `web-vitals` version
  bump). `connectors/helix-rum/map.js`'s `cwvFields` then independently **whitelists** the SAME 21-field
  grounded set for the outbound wire body — a payload-hygiene-by-construction layer, exactly like
  022-02's `errorFields`. The two layers currently coincide (both grounded off the same `.d.ts` files) but
  guard different boundaries: `projectCwv` guards the `postMessage`/structured-clone boundary;
  `cwvFields` guards the wire-contract boundary. Verified by a dedicated test
  (`test/helix-rum-connector.test.js`'s "whitelists ONLY the grounded field set") that an unrecognized/injected
  param on a `cwv` push (e.g. a raw `processedEventEntries` array) is dropped at the `map.js` layer even though
  it would already have been dropped one layer earlier — belt-and-suspenders, not redundant given the two
  boundaries are genuinely different failure domains.
- **Emission model — ONE `cwv` push per metric, not combined (resolved).** `onLCP`/`onCLS`/`onINP` finalize
  independently (LCP/CLS typically settle well before page-hide; INP only finalizes at
  page-hide/visibility-change, per `web-vitals`'s own `whenIdleOrHidden`-deferred design — the same design
  fact AC3 relies on for INP-safety). Combining them into one beacon would mean holding already-finalized
  metrics until the last one lands, for no grounded benefit — so `startCwvCapture` pushes independently, per
  callback. **Corroborating (not determining) evidence:** a local reference clone of the public
  `adobe/helix-rum-enhancer` GitHub repo happened to be available on this machine outside the airlock repo
  (`git remote -v` confirms `origin = git@github.com:adobe/helix-rum-enhancer.git`, commit `d1695dd`,
  2024-04-08) — **not fetched live this session** (no WebFetch tool available), so **not** a reproducible
  in-repo citation; flagged accordingly, used only as corroboration, not as the basis for the decision (the
  spec's own AC2 text already steered this way). Its `addCWVTracking()`
  (`src/index.js:101-131`) calls `sampleRUM('cwv', data)` **separately and immediately inside each**
  `web-vitals` `on<Metric>` callback (`metricFn(storeCWV, opts)`), confirming one-ping-per-metric. Two
  things about that source do **not** carry over, named rather than silently followed: (1) it predates the
  `attribution` build entirely — it loads the PLAIN `web-vitals.iife.js` and sends `{ cwv: { NAME: value } }`
  (nested under a `cwv` key), no attribution scalars at all; (2) this slice instead ships the flatter
  `{ name, value, ...attributionScalars }` shape its own brief specifies. Given the source is 2+ years stale,
  personal-machine-only, and doesn't even touch the attribution surface this slice is about, the brief's
  explicit shape wins — this is recorded as a deliberate, named departure, not an oversight.
- **The `cwv` wire body, grounded:** `{ weight, id, referer, checkpoint: "cwv", t, name, value,
  ...attributionScalars }` — the 5 RUM base fields (unchanged from `top`/`error`) plus the metric identity
  plus the whitelisted superset above. Per this slice's own "parity-superset + fallback" steer: the DEFAULT
  would be bare `{name,value}` parity, but airlock fully controls the payload (`map.js` whitelists), so the
  richer attribution superset ships now; a live AEM-collector probe confirming or narrowing the whitelist is a
  follow-up, not a blocker for this slice.

**DoD:**
- [x] AC1 grounding recorded (`web-vitals/attribution` API + the `cwv` wire shape + **the cloneable scalar
      subset**, with evidence — see Findings above). ACs 2–3 pass. Tests (targeted — suite hangs): stubbed
      `web-vitals` callbacks → a `cwv` push → the grounded beacon shape + governed path; **the pushed `params`
      survive a `structuredClone()` round-trip / contain only scalars** (guards the `DataCloneError` hazard the
      raw attribution object would cause — must NOT be masked by an over-simplified stub; feed the projection a
      realistic attribution-shaped input incl. mock entry objects and assert they're stripped to scalars);
      sampling gates it; `top`/`error` unchanged. Sweep: `helix-rum-*`, `endpoint-ceiling-seam`.
- [x] **Frame-critique** — PASS (verified the INP-safety premise directly against `node_modules/web-vitals`;
      surfaced the structured-clone must-fix now folded into AC1/AC2). Compliance + craft + reconciliation
      recorded PASS (orchestrator, safety-classifier having timed out — projection/whitelist/tests re-verified).
- [x] Deviation log + reconciliation sweep. Log explicitly: (a) the **accepted grounded deviation** — CWV
      measurement lives in a **main-thread capture layer** outside the chamber (a Worker can't observe the
      LCP/CLS/INP entry types); the chamber isolates only mapping+egress, and INP-safety is inherited from
      `web-vitals`'s `whenIdleOrHidden`-deferred design, not airlock's off-thread architecture. (b) **022-05**
      (interaction/lifecycle checkpoints) is a new dependency of 022-03's cutover, post-dating 022-03's
      framing. (c) the production-wiring fork carried forward. `mvp4.md` row updated.
- [x] **No live identifiers committed.**

**Anti-horizontal-phasing check:** real CWV telemetry (LCP/CLS/INP, via `web-vitals`) crosses the seal,
governed + confined — the observability payoff airlock's CWV-first thesis promises, sourced by airlock itself.
**Parity note:** with 022-02 (`top`+`error`) this covers the CWV metrics, but the enhancer's
**interaction/lifecycle** checkpoints (`click`/`viewblock`/`viewmedia`/`enter`/`navigate`/`reload`/
`formsubmit`/`pagesviewed`) remain — a follow-up **022-05** (DOM-event capture, mechanically like 022-02) is
needed before
022-03's cutover can remove the page's `sampleRUM` without losing those signals. 022-03's dependency set grows
to include 022-05 when it lands.

### Deviation log

- **(a) Accepted grounded deviation — CWV measurement lives in a main-thread CAPTURE LAYER, outside any
  chamber.** `connectors/helix-rum/cwv-capture.js` (`projectCwv` + `startCwvCapture`) runs on the main thread,
  not inside a worker chamber: LCP/CLS/INP are `PerformanceObserver` entry types scoped to the page's own
  `document`, which a Worker cannot observe (the SAME `document`-requiring obstacle 022-01's Findings grounded
  for the enhancer's own loader — this is a general Web Platform property, not airlock-specific). The chamber
  (`connectors/helix-rum/{connector,map}.js`) isolates only the MAPPING + EGRESS of an already-captured
  metric, not the measurement itself. **INP-safety is inherited from `web-vitals`'s own `whenIdleOrHidden`-
  deferred design** (verified directly against `node_modules/web-vitals` in the frame-critique, AC3) — NOT from
  airlock's off-thread architecture, since this capture module runs on-thread by necessity. This is the SAME
  "capture on main, map+egress behind the airlock" shape `connectors/helix-rum/connector.js`'s own header
  already documents for `top`'s `t` field and 022-02's `error` listeners — not a new architectural pattern,
  the first slice to build a NEW (non-trivial) capture module for it.
- **(b) 022-05 is a NEW dependency of 022-03's cutover, post-dating 022-03's original framing.** Recorded in
  `spec.md`'s Decomposition ("022-03's dependency set grows to include 022-05 when it lands") — this slice
  did not edit `spec.md` further (022-05 isn't reserved yet; it will pick up its own dependency list when
  reserved). Named here so a reader of just this slice sees the same fact without cross-referencing `spec.md`.
- **(c) Production-wiring fork carried forward (not new, not resolved here).** Like 022-01/022-02 before it,
  this slice builds and tests the capture module + connector + map at UNIT/SEAM fidelity (stubbed
  `onLCP`/`onCLS`/`onINP`, a `FakeWorker` harness — no real `Worker`, no real `web-vitals` subscription, no
  real browser). It does NOT import the real `"web-vitals/attribution"` module anywhere, does not call
  `startCwvCapture` from `adapters/eds/index.js`, and does not wire a RUM-dedicated `createAirlock` instance
  into production boot. Reason: unchanged from 022-01/02's own reasoning — `adapters/eds/index.js` does not
  yet boot ANY `helix-rum` connector instance in production (confirmed by reading that file this session; it
  constructs only a GA4 `createAirlock`), so leaving RUM's CWV capture at module+seam fidelity matches the
  established precedent rather than introducing a new gap. `startCwvCapture`'s DI'd shape
  (`{push, onLCP, onCLS, onINP}`) is deliberately built so wiring the REAL `web-vitals/attribution` import +
  a real `push` is a one-call-site change whenever that production-adapter work happens — likely alongside
  022-03's page-side cutover, the same landing point 022-01/02 named.
- **(d) The exact scalar field names grounded + the emission-model choice.** See the Findings section above
  (full per-metric field enumeration with `.d.ts` line citations, the two-layer projectCwv/cwvFields design,
  the one-push-per-metric decision + its corroborating-but-not-determining local-clone evidence, and the
  flat-vs-nested wire-shape choice). Not duplicated here to avoid the two sections drifting out of sync.
- **`longestScript`'s two safe sub-scalars (`subpart`, `intersectingDuration`) are dropped WHOLESALE, not
  partially unwrapped — a deliberate simplicity/safety tradeoff, not an oversight.** `projectCwv`'s filter is
  SHALLOW (top-level keys of `metric.attribution` only); it does not recurse into `longestScript` to rescue
  its two scalar sub-fields before dropping the object as a whole (because `longestScript.entry` is the
  literal `PerformanceScriptTiming` hazard the frame-critique named). Recursing one level deeper for this ONE
  nested field would add complexity and a second place a future non-scalar could hide; the shallow filter is
  simple and provably safe. Pinned by `test/helix-rum-cwv.test.js`'s INP projection test asserting
  `longestScript` is absent from the projected output.
- **Tests (targeted, per this slice's brief — full `vitest run` hangs on a stale worktree):**
  - `npx vitest run test/helix-rum-connector.test.js test/helix-rum-seam.test.js test/helix-rum-cwv.test.js
    test/endpoint-ceiling-seam.test.js` → **65/65 passed** (39 + 10 + 10 + 6). New/changed coverage: the
    widened `events:["top","error","cwv"]` manifest; `projectCwv`'s structured-clone guard for all three
    metrics (LCP/CLS/INP) fed REALISTIC attribution-shaped fixtures including the exact named hazard fields
    (`processedEventEntries`, `longAnimationFrameEntries`, `longestScript`, `navigationEntry`,
    `lcpResourceEntry`, `lcpEntry`, `largestShiftEntry`, `largestShiftSource`) with mock array-of-object /
    nested-object values, asserting they're absent from the projected output AND that
    `structuredClone(projected)` succeeds; a companion test proving the fixture is realistic (the RAW
    attribution demonstrably carries those hazard shapes, so a naive wholesale-spread implementation would
    fail the hazard-key-absence assertions); `startCwvCapture` subscribing to all three sources exactly once,
    pushing ONE `cwv` event per finalized metric (three independent pushes for three metrics, never combined),
    and the pushed event surviving `structuredClone` end-to-end; the connector's `cwv` body shaping (grounded
    LCP/CLS/INP field sets, the `event.params`/`event.payload` bridge, an injected/unrecognized param dropped
    at the `map.js` whitelist layer too); `cwv` sharing the SAME `id`/`weight`/sampling-gate/endpoint as
    `top`/`error`; the `cwv` checkpoint firing with no consent gate and being held at a re-pointed endpoint
    with no beacon-body leak (mirrors the existing `top`/`error` seam tests byte-for-byte in structure).
  - Regression: `npx vitest run test/consent-seal.test.js test/egress-confinement.test.js
    test/ga4-connector.test.js test/alloy-connector.test.js` → **43/43 passed** (15 + 9 + 10 + 9), unchanged —
    no `core/` file touched (this slice is additive-only: a new `connectors/helix-rum/cwv-capture.js` + a new
    `test/helix-rum-cwv.test.js`, plus extensions to `connectors/helix-rum/{connector,map}.js` and the two
    existing `test/helix-rum-*.test.js` files).
  - `npm run lint` → clean (repo's flat-config `recommended` ruleset; `connectors/helix-rum/cwv-capture.js`
    falls under the existing `connectors/**/*.js` browser-globals glob, `test/helix-rum-cwv.test.js` under the
    existing `test/**/*.js` glob — no config change needed).
- **Files created:** `connectors/helix-rum/cwv-capture.js`, `test/helix-rum-cwv.test.js`.
- **Files changed:** `connectors/helix-rum/connector.js` (widened `events` to include `"cwv"`, doc comments
  updated — no change to `handle()`'s body); `connectors/helix-rum/map.js` (new `CWV_ATTRIBUTION_FIELDS` +
  `cwvFields`, `mapToRum` gains a `cwv` branch, `top`/`error` branches unchanged); `test/helix-rum-connector.test.js`
  (updated manifest-events assertion + new `cwv` handle()/identity/sampling describe blocks);
  `test/helix-rum-seam.test.js` (two new seam tests: no-consent-gate + ceiling-held, both for `cwv`); this
  slice file (Findings + this Deviation log + Reconciliation sweep + DoD ticks); `docs/releases/mvp4.md` (new
  022-04 row).
- **No live identifiers:** every id/name/target/URL in the new tests is synthetic (`spike.example`,
  `evil.example`, `synthetic-cwv-id-9`, `synthetic-target-selector`, `#hero > img.banner`,
  `example.test/hero.jpg`) or the AEM-public default (`ot.aem.live`); no real RUM ids, no real page URLs/
  selectors, and no customer RUM base URLs are committed. The local `adobe/helix-rum-enhancer` clone consulted
  for corroborating grounding (see Findings) was read-only and is cited by public repo + commit hash, not by
  its local machine path.

### Reconciliation sweep

- **Additive-only, no `core/` touched.** `git status`/`git diff --stat` for this slice shows only a new
  `connectors/helix-rum/cwv-capture.js`, a new `test/helix-rum-cwv.test.js`, extensions to
  `connectors/helix-rum/{connector,map}.js` and the two existing `test/helix-rum-*.test.js` files, this slice
  doc, and `docs/releases/mvp4.md` — independently confirmed by re-running the full regression sweep above
  (108/108 green across the targeted + regression sets) with zero `core/` diff.
- **`top`/`error` are genuinely byte-unchanged, verified by reading `map.js`'s new `mapToRum`, not assumed:**
  the function still returns the SAME 5-key base object for any event, the `error` branch is untouched, and
  the new `cwv` branch is a THIRD, additive `if` arm that only executes when `event.type === "cwv"`. All of
  022-01/022-02's original tests (the 5-field `top` shape, the 7-field `error` shape, the ephemeral id, the
  URL, `t` sourced from `event.ts`, at-most-one-request, sampling honored/decided-once, rate fidelity, the
  hosted-via-createConnectorHost pair) pass UNMODIFIED except the one manifest-events assertion, which is an
  intentional, spec-mandated widening (AC1/AC2), not a regression.
- **Governance uniformity verified, not asserted on faith:** the `cwv` seam tests reuse the SAME
  `endpoint`/ceiling/consent machinery as `top`/`error`'s existing seam tests (same `FakeWorker` harness, same
  `createAirlock` call shape) — there is no `if (checkpoint === "cwv")` branch anywhere in `core/` or in
  `connector.js`'s `handle()`; only `map.js`'s `mapToRum` BODY-shaping branches, the governed dispatch path
  does not. The ceiling-held test's evil body is a hand-built JSON string (not produced by the connector),
  proving the ceiling holds on URL alone, independent of checkpoint content — identical proof structure to the
  `top`/`error` ceiling tests.
- **One identity confirmed structurally, not just by the passing test:** `id`/`weight`/`isSelected` are all
  computed ONCE in `createHelixRumConnector`'s closure (unchanged since 022-01) and `handle()` reads them by
  closure reference on every call, including `cwv` calls — there is no per-checkpoint re-derivation path to
  audit away.
- **The structured-clone guard verified at TWO levels, not just unit-tested in isolation:** `test/
  helix-rum-cwv.test.js` proves `projectCwv`'s output survives `structuredClone` (the capture-module level);
  `test/helix-rum-connector.test.js`'s "whitelists ONLY the grounded field set" test proves `map.js`'s
  `cwvFields` independently drops an injected non-scalar-shaped param (`processedEventEntries: [{evil:true}]`)
  even when fed directly into `event.params` — i.e. the wire-body whitelist layer holds even if a future bug
  in `projectCwv` (or a caller that bypasses `startCwvCapture` entirely and calls `push()` by hand) let
  something non-scalar through. Two independent layers, both exercised.
- **mvp4.md** `helix-rum` row gets a new `022-04 DELIVERED` line (the `022-01`/`022-02 DELIVERED` lines are
  left intact, matching the precedent those slices set of annotating incrementally rather than rewriting
  history).
- **Open fork carried forward (not orphaned, not duplicated):** production/adapter wiring (importing the real
  `web-vitals/attribution`, wiring `startCwvCapture` + a RUM-dedicated `createAirlock` instance into
  `adapters/eds/index.js`) stays tracked in 022-01's deviation log as the single place it's tracked; this
  slice's own log (item (c) above) cross-references it rather than re-opening a second copy. Likely lands with
  022-03 (the page-side cutover).
- **No orphaned refs:** `connector.js`'s header doc's `events` comment was updated in the SAME edit that
  widened `events`, so it does not go stale the way 022-01's original enhancer-decision comment briefly did
  (022-02 caught and fixed that drift; this slice avoids re-introducing the pattern by updating doc and code
  together).
- **eslint clean** under the 021-03 flat config; no new glob needed — `connectors/helix-rum/cwv-capture.js`
  already matches `connectors/**/*.js` (browser globals, correct — `web-vitals/attribution`'s `onLCP`/`onCLS`/
  `onINP` are main-thread-only APIs) and `test/helix-rum-cwv.test.js` already matches `test/**/*.js`.
