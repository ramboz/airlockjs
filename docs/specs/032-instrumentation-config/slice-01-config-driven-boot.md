---
status: RECONCILED
dependencies: []
last_verified: 2026-09-04
arch_review: true  # introduces a new PUBLIC authoring surface (`boot(config)` + the project config shape).
frame_review: true  # core bet: one config can express heterogeneous connectors without losing GA4's rich wiring.
claimed_by: claude/mvp6-e4550f
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions below — never assert an unverified claim as fact. -->

## Slice 032-01 — the config-driven `boot(config)`: connector dispatch + collapse the pixel-boot duplication

**Goal:** a single exported **`boot(config)`** takes a project JSON config declaring **which connectors + their
ids/endpoints + consent + payload governance**, and boots each declared connector — collapsing the three
near-identical pixel-vendor boot functions into one config-driven dispatch, threading governance to each
connector **per its governance class**, and returning a **composite handle that owns `window.airlock`** with a
unified `dispose()`/`setConsent()` that fan out across all booted connectors. It keeps the existing per-connector
boots working (back-compat). The "few lines + a rich JSON config" authoring ergonomic, pre-1.0.

**Load-bearing lifecycle correction (frame-critique):** today only `bootEdsAnalytics` owns `window.airlock` and
carries the 021-01 dispose-prior-on-reboot **no-leak** invariant; the pixel boots take no `window` slot. A naive
multi-connector `boot()` that just reuses those per-connector boots would make `window.airlock` GA4-only —
`dispose()`/re-boot would **leak the pixel/rum Worker + listeners** and `setConsent()` would miss the pixel (a
governance hole). So `boot(config)` must **hoist** `window.airlock` ownership into a composite (AC4), preserving
021-01 across the whole config. And governance threads **per governance class**: consent-governed connectors (GA4,
pixels) get the consent/denylist gating; **helix-rum keeps its spec-022 class** (not consent-gated, no denylist,
sync, no-op-when-unselected) — the config does not gate or strip it (AC3).

**DoR:**
- ✅ The 5 boot functions + their `createAirlock` dispatch shapes are understood
  ([`adapters/eds/index.js`](../../../adapters/eds/index.js), read this session).
- ✅ The pixel-vendor config factories (`createMetaPixelConfig` etc.) + `*_EGRESS_PURPOSES` are the seed of a
  config-driven model (same file / `connectors/pixel/vendors/`).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The core, load-bearing bet this slice proves:** a JSON config entry can express each connector's setup, and
  `boot(config)` can dispatch it, **without losing GA4's richer wiring** — the ga4 entry must still reach the
  host-side `_ga` cookie sourcing, the pre-`createAirlock` consent fold, and the UC-2/UC-3 capture listeners
  (`wireInteractions`/`wireExposure`/`wireBlocks`). The honest design: the config **selects + parameterizes**
  connectors (the config carries ids/endpoints/consent/governance), while GA4's built-in capture stays built-in;
  the config does not re-express capture. Grounded that the *pixel* entries are pure parameterization (they already
  are — `createXxxConfig` + `createAirlock`); UNPROVEN that the *ga4* entry stays byte-equivalent to
  `bootEdsAnalytics` when driven from config — AC1/AC4 are its proof.
- **Back-compat is a property of reuse, not reimplementation — with lifecycle HOISTED, not forked (frame-critique
  correction):** the config path routes through the SAME per-connector *boot* logic the existing functions use (so
  the wiring cannot drift), but the **lifecycle ownership** — the `window.airlock` singleton and a composite
  `dispose()`/`setConsent()` — is **hoisted into a new composition layer over** the per-connector boots (AC4). This
  is not a fork of the boot logic; it is the missing layer the current per-function boots never needed (only GA4
  took `window.airlock`; the pixel boots note "no established convention for a second, vendor-specific instance
  yet"). The composite MUST preserve 021-01's dispose-prior-on-reboot **no-leak** invariant across **all** booted
  connectors (grounded: `adapters/eds/index.js:433-436`; 021-01 AC2; still claimed at `docs/releases/mvp6.md`).
- **Governance is per governance class, not uniform (frame-critique correction):** consent-governed connectors
  (GA4, pixels) receive the config's `consent`/`consentStrict`/`payloadDenylist` with the existing gating.
  **helix-rum is exempt by design** — spec 022 governance class: `egressPurposes: []` unconditional, no
  consent/denylist opts, **sync** boot, returns a `sampled` flag + a full no-op handle for an unselected page
  (grounded: `adapters/eds/index.js:689-747`, `:723`). `boot(config)` must dispatch it without forcing it into the
  async/consent-gated mold, and top-level governance must NOT gate or strip it. Assumption until AC3 witnesses the
  carve-out.

**Acceptance Criteria:**

1. **A config-driven `boot(config)` entry.** A new exported `boot(config)` accepts a project config of shape
   `{ connectors: [ {type, …}, … ], consent?, consentStrict?, payloadDenylist? }` and boots each declared
   connector, returning the **composite handle of AC4** over the public write surface
   (`push`/`getState`/`setConsent`/`dispose`/…). Observable: `boot({ connectors: [{ type: "ga4", … }] })` boots GA4
   equivalently to `bootEdsAnalytics()` — `window.airlock` set, the UC-2 interaction path wired, a beacon fires.
2. **The pixel-vendor boot duplication is collapsed into config dispatch.** A config entry
   `{ type: "pixel", vendor: "meta"|"linkedin"|"bing", …ids, endpoint? }` dispatches to the right vendor config
   factory + `createAirlock({ connector: "pixel", … })` + the vendor's egress purposes — replacing the three
   near-identical `bootMetaPixel`/`bootLinkedInInsight`/`bootBingUet` bodies with ONE parameterized path (a
   vendor registry / table, not three copies). The three functions are kept but now **delegate** to it (or are thin
   wrappers). Observable: a `boot({connectors:[{type:"pixel",vendor:"meta",pixelId:X}]})` produces the SAME
   `createAirlock` inputs (connector `"pixel"`, the Meta connector config, `META_EGRESS_PURPOSES` under the
   `consent ? … : []` gate) that `bootMetaPixel({pixelId:X})` produces — asserted equal, all three vendors.
3. **Governance threads per governance class — consent-governed connectors get it; helix-rum is exempt.** The
   config's `consent`/`consentStrict`/`payloadDenylist` are applied to each **consent-governed** connector (GA4,
   pixels) with the SAME gating the per-function `opts` use today (`egressPurposes` gated on `consent` presence; the
   GA4 storage-consent fold preserved). **helix-rum keeps its spec-022 governance class** — the config does NOT
   consent-gate it, strip its payload, or force it async; its `egressPurposes` stay `[]` and its sync
   `sampled`/no-op-when-unselected shape is preserved. Observable: for GA4/pixels, config-supplied consent yields
   per-connector gating byte-identical to passing the same vector to the per-function boots (absent vector → legacy
   always-dispatch); for helix-rum, the booted connector is byte-identical to `bootHelixRum` regardless of the
   config's consent/denylist.
4. **A composite handle owns `window.airlock`, with a unified lifecycle that preserves 021-01's no-leak invariant.**
   `boot(config)` returns a **composite handle** set on `window.airlock` (hoisted out of the per-connector boots —
   AC1's ga4 entry no longer unilaterally owns the slot). Its `dispose()` tears down **every** booted connector's
   Worker + listeners, and a re-`boot()` disposes the **entire prior composite** first — so a multi-connector
   re-boot **leaks nothing** (the 021-01 AC2 invariant now holds across the whole config, not just GA4). Its
   `setConsent(v)` fans out to **every consent-governed** connector (not only GA4). Observable: after
   `boot({connectors:[{ga4},{pixel:meta}]})`, `window.airlock.dispose()` disposes BOTH (assert each connector's
   `dispose` called / no worker survives) — and a seeded regression proving the OLD GA4-only ownership would leak
   the pixel Worker on re-boot goes red→green; `window.airlock.setConsent(v)` reaches the pixel instance, not only
   GA4.
5. **End-to-end + back-compat.** A test/rig boots a **multi-connector** config (e.g. GA4 + a pixel) via
   `boot(config)` and asserts each declared connector boots and its beacon path fires; and the existing per-function
   boots + the full suite stay green (the testbed/rigs are unaffected). Observable: the config-driven multi-connector
   boot test passes; `npm test` + the existing rigs stay green (no regression).

**DoD:**
- [x] All ACs pass; full test suite green (no regressions — modulo the pre-existing, out-of-scope prism load failure).
- [x] Implementer test coverage exercises each AC with at least one fixture; edge cases covered explicitly.
- [x] Each new test shown to fail when its feature is removed (red→green witnessed) — AC2's per-vendor-boot input
      equivalence, AC3's consent-gating parity (+ the helix-rum carve-out), AC4's re-boot-no-leak regression, the
      fan-out-gate leak, and the partial-boot cleanup.
- [x] Reviewed by `reviewer` subagent (compliance + craft; **arch** pass, since `arch_review: true`; **frame-critique**, since `frame_review: true`).
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] `docs/refinement-todo.md` updated if any decisions were deferred during implementation (the 032 config-surface follow-ups).

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [ ] Primer hygiene (spec 025-01): if this slice closes the spec, compress the Active-specs entry; note the new
      `boot(config)` authoring surface where instrumentation is documented.

**Anti-horizontal-phasing check:** after this slice lands, a developer can boot airlock's supported connectors from
a single JSON config object (a few lines) and see the declared connectors' beacons fire — the config-driven
authoring ergonomic, end-to-end, not intermediate state.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

- **Shape.** `boot(config)` (in `adapters/eds/index.js`) dispatches each `{type,…}` entry via `bootConnector`, which
  returns `{handle, events}` (the connector's declared `manifest.events` vocabulary). `createComposite(connectors)`
  owns the public write surface. Shared helpers extracted: `bootGa4Core` (the GA4 boot **without** the window slot),
  `installOnWindow` (the `window.airlock` lifecycle), `PIXEL_VENDORS` (a vendor registry) + `bootPixelConnector`
  (the ONE pixel path). The three pixel boots + `bootEdsAnalytics` are kept as **thin delegating wrappers**
  (`bootEdsAnalytics = installOnWindow(await bootGa4Core(...))`) — back-compat preserved; the testbed/rigs untouched.
- **GA4-from-config equivalence (the core bet) — PROVEN.** The ga4 config entry reuses `bootGa4Core` **verbatim**, so
  the `_ga` sourcing, the pre-`createAirlock` consent fold, and the UC-1/2/3 capture listeners cannot drift; the
  equivalence tests assert byte-identical `createAirlock` inputs vs the per-function boots.
- **`window.airlock` factoring.** Ownership lives in exactly two callers — the `bootEdsAnalytics` wrapper (single
  GA4) and the `boot(config)` composite (whole config) — never in the shared `bootGa4Core` or a per-connector boot.
  No double-ownership; the composite `dispose()` fans to every connector, and a re-`boot()` disposes the entire
  prior composite (021-01 no-leak holds config-wide).
- **Governance per class.** consent/`consentStrict`/`payloadDenylist` thread to the consent-governed connectors
  (GA4, pixels); helix-rum is booted from its own fields only (spec-022 class: `egressPurposes:[]`, sync,
  `sampled`/no-op-when-unselected) — byte-identical to `bootHelixRum` regardless of the config's governance.
- **Composite `push()` fan-out — the pinned decision (frame-critique deferred it to arch; craft found the leak).**
  `push(evt)`/`pushCritical(evt)` deliver to a connector **only if** its declared `manifest.events` is `["*"]` (GA4,
  the analytics catch-all) or lists `evt.event` (pixels' `eventMap` keys; helix-rum's `top`/`error`/`cwv`). So an
  arbitrary site event reaches GA4 but **never crosses to helix-rum** (closing the craft [blocker]: without the
  gate, `push({event:"newsletter_signup"})` leaked that name to `ot.aem.live` as a checkpoint). `setConsent`/
  `dispose`/`flushNow` fan to all (lifecycle); `getState`/`stats` read `handles[0]` (documented ordering caveat).
- **Reviewer findings folded in.** Frame-critique (needs-changes → the composite-lifecycle + helix-rum-carve-out
  reframe → pass). Arch pass (pass; nits below). Compliance (pass; 1007-suite green, 4 seeded regressions
  re-verified by mutation). Craft (needs-changes → the fan-out-gate + partial-boot fixes → pass):
  - **Craft [blocker] FIXED** — the composite fan-out gate above (`acceptsEvent`), with a red→green gate test.
  - **[nit] FIXED — partial-boot leak:** `boot()` now try/catches the loop and disposes already-booted handles
    before rethrowing (021-01 on the error path); red→green test asserts the ga4 Worker is disposed after a mid-loop
    throw. **This also RESOLVES the arch pass's same nit.**
  - **[nit] getState/stats ordering** — documented caveat (reads track connector[0]); no behavior change.
- **ADR-trigger considered — kept in-spec.** The composite/fan-out model is a load-bearing public-API choice with
  rejected alternatives (per-connector handles vs a composite; ungated vs manifest-gated fan-out), but it is
  **pre-1.0** and 032-02 pins the config contract; captured in the ACs + arch/craft evidence + this log. No
  standalone ADR (the later 1.0 API pin owns freezing it), consistent with 031's in-spec-per-delegation posture.
- **Deferred (recorded in `docs/refinement-todo.md`):** declarative event-capture / per-event routing (incl. whether
  GA4's `["*"]` catch-all should gain an `eventMap` opt-in so "each tag reacts" is symmetric with pixels); the
  `GA4_MANIFEST_EVENTS`/`HELIX_RUM_MANIFEST_EVENTS` local-mirror → single-source-of-truth drift-coupling (craft nit,
  esp. re 022's checkpoint widening); per-connector read namespacing + surfacing helix-rum's `sampled` on the
  composite. None block this slice.
- **Plan adherence.** ACs 1–5 implemented as (re-)specified after the frame-critique reframe; no scope creep. New
  file behavioral + equivalence tests: 20 pass; broader adapter/pixel/helix sweep green; lint clean; the
  pre-existing `dom-chamber-host-prism` prism-load failure is unrelated + untouched.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `adapters/eds/index.js` | `updated` | The `boot(config)` dispatcher + `bootConnector` + `createComposite` (manifest-gated fan-out) + `installOnWindow`/`bootGa4Core` extraction + `PIXEL_VENDORS`/`bootPixelConnector` + the 3 delegating wrappers + the partial-boot cleanup. |
| `test/eds-boot-config.test.js` + `test/eds-boot-config-equivalence.test.js` | `updated` | New: behavioral (real `createAirlock` + all-worker-tracking FakeWorker) + input-equivalence (mocked `createAirlock`) — 20 tests incl. the fan-out-gate + partial-boot red→green regressions. |
| `docs/specs/032-instrumentation-config/spec.md` | `updated` | The frame-critique reframe added the composition-layer + per-governance-class Assumptions bullets (status DRAFT→IN_PROGRESS is the transition helper's automatic rollup, not a hand edit). |
| `README.md` | `no-op` | The documented config/instrument story lands in **032-02** (its AC4); no README snippet touched here. |
| `docs/specs/README.md` | `deferred` | Status-board regen is close-out (orchestrator `workflow.py status-board`), not hand-edited here. |
| `docs/product-vision.md` | `no-op` | Checked — the config surface serves UC-2 (analytics instrumentation), no new UC or behavior/scope drift. |
| `docs/architecture.md` | `no-op` | Checked — `boot(config)` is a new public surface but pre-1.0; it is pinned/documented in **032-02** (the config contract), where the Contract-surfaces note belongs. No boundary drift to record here. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Checked; spec-close primer compression is 032-02's close-out. No Hot-Cache term warranted for the mid-flight surface. |
| `docs/inbox.md` | `no-op` | Nothing to park — the deferred follow-ups went to `refinement-todo.md` (below). |
| `docs/refinement-todo.md` | `updated` | Added the 032 config-surface follow-ups: declarative capture / per-event routing (incl. the GA4-`["*"]`-vs-eventMap-gate symmetry question), the `*_MANIFEST_EVENTS` local-mirror → single-source-of-truth drift-coupling, and the per-connector read-namespacing / `sampled`-surfacing nits. |
| `docs/memory/**` | `no-op` | The config surface + decisions are captured in spec 032 + the review evidence; no new reusable domain term. |
| `docs/decisions/README.md` / ADR index | `no-op` | ADR-trigger considered — the composite/fan-out model is kept in-spec (pre-1.0; 032-02 pins the contract; the 1.0 pin owns freezing), consistent with 031's in-spec-per-delegation posture. No new/amended ADR. |
