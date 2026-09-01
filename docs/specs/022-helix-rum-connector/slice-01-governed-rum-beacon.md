---
status: DONE
dependencies: []
last_verified: 2026-09-01
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 022-01 — governed page-view RUM beacon (+ A/B grounding)

**Goal:** Ship ONE real, **confined** RUM beacon end-to-end — a `top`/page-view checkpoint captured on the
main thread, shaped into the AEM RUM wire contract, and egressed under airlock's **RUM governance class**
(endpoint ceiling on `ot.aem.live` + payload-hygiene — **NOT** consent-gated; RUM is PII-compliant performance
telemetry not subject to consent, maintainer 2026-08-31) to the AEM RUM collector. Along the way, **ground the
load-bearing hosting fork** (A: wrap the enhancer in a chamber vs B: reproduce the beacon natively) and record
which mechanism 022-02 builds on. (The `top` beacon uses **no** CWV; the "fed by airlock's CWV capture" part
of mechanism B is 022-02's enhancer concern, not this slice's.) This is the vertical minimum: a confined RUM
ping exists.

**DoR:**
- ✅ The `sampleRUM` **core beacon contract** is grounded (`probes/eds-testbed/scripts/aem.js:14-135`, read
  2026-08-31): `navigator.sendBeacon(".rum/${weight}"@ot.aem.live, { weight, id, referer, checkpoint, t,
  …pingData })`; `id = crypto.randomUUID().slice(-9)`; `top` fires on page load.
- ✅ airlock already owns the confinement primitives this rides on: `navigator.sendBeacon` interception
  (`denySendBeacon`, `applyEgressConfinement` — `core/egress-confinement.js`, wired in the alloy chamber) +
  the **endpoint ceiling** (`core/endpoint-ceiling.js`, scheme+origin+path). **Grounded** (in-repo, this
  session). **RUM is NOT consent-gated** (maintainer, 2026-08-31) — the consent seam
  (`egressVerdict(..., {strict})`) deliberately does **not** apply to this connector; see spec § Governance
  class.
- ⚠️ **NOT yet grounded (this slice's first job):** the `helix-rum-enhancer` runtime — does it require
  main-thread `PerformanceObserver`/DOM (⇒ mechanism A is hard, favour B), and what version/SRI to pin.

**Acceptance Criteria:**

1. **Ground the hosting mechanism (A vs B) and RECORD it.** Probe `helix-rum-enhancer`'s actual runtime
   dependencies (read its source / a real load) — specifically whether its CWV/interaction collection needs
   main-thread `PerformanceObserver` + `document` a chamber cannot provide. Record the finding + the chosen
   mechanism for the **core** path (lean B: reproduce the small `top` beacon contract — which needs no CWV;
   the enhancer's runtime CWV feed is 022-02's concern) and note the **enhancer** decision explicitly for
   022-02. If the probe shows (A) is cleanly feasible, record that instead — the grounding decides, not the
   lean.
2. **One confined page-view beacon, end-to-end (NOT consent-gated).** A `top`/page-view checkpoint is
   captured on the main thread, shaped into the grounded RUM payload (`{ weight, id, referer,
   checkpoint:"top", t }`), and egressed under the RUM governance class: an **endpoint ceiling pinned to
   `ot.aem.live`** (scheme https, the `.rum/` path) + a **payload-hygiene guard**. Under mechanism B the
   payload is airlock-constructed, so hygiene is **by construction** — the guard is a test assertion that the
   beacon carries ONLY `{ weight, id, referer, checkpoint, t }` (the ephemeral per-page `id`; no cookie /
   cross-page / persistent identifier / other PII). The not-consent-gated class is **free** on the existing
   seam (frame-critique, 2026-08-31): the manifest declares `endpoints:[ot.aem.live]` + **no** egress
   purposes, so `core/airlock.js` applies the ceiling (`ceiling.length`) and skips the consent gate
   (`egressPurposes` empty) with no new machinery.
   Observable: with the endpoint allowed, one RUM beacon reaches the collector shape **regardless of consent**
   (RUM is not subject to it — a deliberate, tested contrast with the GA4/alloy consent seam); with the
   endpoint **re-pointed** to a non-`ot.aem.live` host, it is **held** (redacted diagnostic, no beacon). The
   beacon is byte-shaped so the AEM RUM pipeline accepts it (the `.rum/${weight}` URL + JSON body match the
   grounded contract).
3. **No page-side change yet + no double-emit from airlock.** This slice adds airlock's governed path only;
   the page's inline `sampleRUM` removal is 022-03. airlock emits **at most one** `top` beacon per selected
   page-load (no duplicate with its own future checkpoints). The honest boundary (airlock + page both emit
   until 022-03 cuts the page over) is **named**, not hidden.

**Findings (AC1 — the A/B grounding, this session, 2026-09-01):**

- **Core (`top`) path — mechanism B, confirmed (not just leaned).** The grounded `sendPing` contract
  (`probes/eds-testbed/scripts/aem.js:94-124`) needs no CWV, no `PerformanceObserver`, no DOM read — only a
  fixed `weight`, an ephemeral `id`, a host-sourced `referer`, and a capture-time `t`. This slice's
  `connectors/helix-rum/connector.js` reproduces it natively (mechanism B), hosted by the SAME
  `core/connector-host.js` GA4/alloy use — no chamber-hosting probe was needed for this checkpoint, exactly as
  the spec's Assumptions predicted ("the core… needs neither[CWV nor the hosted enhancer]").
- **Enhancer — mechanism A is NOT cleanly feasible; the definitive live probe is still deferred to 022-02.**
  Two independent, in-repo-grounded obstacles (source-read + one real-browser-verified fact; no WebFetch this
  session, so the actual `@adobe/helix-rum-enhancer` package was **not** fetched or loaded — per this slice's
  brief):
  1. **Loading mechanism requires `document`.** `sampleRUM.enhance()` (`aem.js:126-145`) loads the enhancer via
     `document.createElement('script')` + `document.head.appendChild(script)` — a classic DOM script-tag
     injection, not a fetchable/`import()`-able specifier a chamber could intercept. `rig/isolation.mjs` (spec
     007-02) already proves, with a **real browser Worker** (Playwright, not a Node stand-in), that a bare
     `document` reference **throws `ReferenceError`** inside a chamber's realm. This is a Web-platform Worker
     property (no `document` in any `DedicatedWorkerGlobalScope`), not an airlock-specific restriction, so it
     generalizes to a hypothetical helix-rum-enhancer chamber: the enhancer's own loader cannot run there.
  2. **Egress requires `navigator.sendBeacon`.** The SAME `sendPing` the `top` checkpoint uses (and which the
     loaded enhancer calls back into via the exposed `window.hlx.rum.sampleRUM`/`.collector`, per
     `aem.js:39-46,685`) egresses via `navigator.sendBeacon(url, body)` (`aem.js:120`) — which
     `core/egress-confinement.js`'s `denySendBeacon` **throws** on inside any airlock chamber (grounded by
     reading that file this session). Mechanism A would need to additionally re-plumb the enhancer's beacon
     calls onto the mediated fetch before any of its checkpoints (CWV or otherwise) could reach the network.
  - **Not independently re-verified this session:** whether the enhancer's CWV collection is itself
    `PerformanceObserver`-based, and for which entry types. This is a well-established Web Platform property
    (LCP/CLS/INP-family entries are Window/document-scoped in the Performance Timeline family of specs, not
    exposed in a Worker global scope) but was not probed live here — consistent with obstacle 1 already being
    sufficient (no `document` ⇒ the enhancer's loader itself cannot run in a chamber, independent of what its
    CWV collector needs) and with this slice's brief ("do NOT fetch the enhancer... defer the live probe to
    022-02").
  - **Conclusion:** the grounding does **not** show (A) is cleanly feasible — it strengthens the spec's
    existing lean toward (B) for the enhancer too (with the caveat above named, not hidden). 022-02's
    "grounded enhancer decision" should treat mechanism A as requiring a chamber DOM/PerformanceObserver
    proxy (a large, unproven lift) or an enhancer re-plumbed onto mediated fetch, and should weigh mechanism B
    (extending this slice's native reproduction to the `error` + CWV/interaction checkpoint set, per the
    spec's Assumptions "airlock has no *runtime* per-page CWV capture yet") against that cost with a live
    probe first.

**DoD:**
- [x] AC1 grounding recorded (enhancer runtime + A/B decision, with the probe evidence). ACs 2–3 pass. Tests:
      the confined page-view beacon path (endpoint allowed → shaped beacon; endpoint **re-pointed** off
      `ot.aem.live` → held); the beacon fires **regardless of consent** (RUM is not gated on it — a tested
      contrast with the GA4/alloy seam); the payload matches the grounded wire contract + carries no PII beyond
      the ephemeral `id`. Targeted sweep (full suite hangs): the new connector's tests + `endpoint-ceiling*`,
      `egress-confinement` (and `consent-seal` to prove RUM does NOT trip it).
- [x] **Frame-critique** (the load-bearing premise: "host `helix-rum-js`" = wrap the enhancer in a chamber —
      the grounding may show the core is a native beacon-reproduction, not a wrapped SDK; do not build a
      chamber-host on an ungrounded feasibility) + compliance + craft + reconciliation.
- [x] Deviation log + reconciliation sweep; the `helix-rum` connector's manifest (endpoints `ot.aem.live`,
      **no egress purposes** — the not-consent-gated RUM class) declared per ADR-0006/0007; mvp4.md
      `helix-rum` row updated.
- [x] **No live identifiers committed** (no real RUM `id`s, no customer RUM base URLs beyond the public
      `ot.aem.live` default — synthetic ids only).

**Anti-horizontal-phasing check:** a real RUM beacon is **confined** to `ot.aem.live` (endpoint ceiling +
payload-hygiene, **not** consent-gated) — an observable governance change on the egress path. Honest value
(frame-critique temper): until 022-03 removes the page's `sampleRUM`, airlock's `top` is *redundant* with the
page's own, so 022-01 delivers **"a governed/confined RUM path exists"**, not net-new telemetry (the
double-emit is named in AC3). The A/B grounding is folded into the
slice that ships the first beacon (no standalone spike), per SPIDR discipline.

### Deviation log

- **Scope fork FLAGGED, not decided here: production/adapter wiring.** This slice builds and tests the
  `helix-rum` connector (manifest + `handle()`) at the SAME fidelity GA4/alloy's own connector suites use
  (unit tests against the connector directly + hosted via `createConnectorHost`, plus `core/airlock.js` seam
  tests with the established `FakeWorker` harness — no real `Worker`). It does **not** wire a `push({event:
  "top"})` capture call into `adapters/eds/index.js`, and does not build a dedicated
  `helix-rum-chamber.worker.js` or extend `core/airlock.js`/`createAirlock` to host more than one connector in
  one worker. Reasons: (a) `core/airlock.js` currently hardcodes a SINGLE Worker pointed at GA4's
  `chamber.worker.js` — hosting a second connector requires either a second dedicated worker+orchestrator pair
  (alloy's own pattern) or making `core/airlock.js` connector-generic, and neither is decided by this slice's
  brief; (b) **alloy itself is not yet wired into `adapters/eds/index.js`'s production boot either** (confirmed
  by reading that file this session — `bootEdsAnalytics` constructs exactly one GA4 `createAirlock`), so
  leaving RUM at connector+seam fidelity for 022-01 matches the established precedent, not a new gap. Flagged
  per this slice's own guardrail ("whether this needs the full chamber-host or a lighter path... FLAG it")
  rather than invented. Likely 022-02's (a full checkpoint surface implies a real host) or 022-03's ("the
  page-side cutover... demonstrated in `probes/eds-testbed`") concern.
- **Manifest name resolved: `airlock/helix-rum`.** [mvp4.md](../../releases/mvp4.md) listed `airlock/rum` /
  `airlock/helix-rum` as open options ("pin its manifest… before implementation"); this slice pins
  `airlock/helix-rum` (matches the connector directory + the slice's own `createHelixRumConnector` naming). A
  low-stakes naming choice, not a design fork — noted for completeness since it was genuinely open.
- **`t` (capture time) sourced from the existing descriptor `ts` field, no new capture plumbing.**
  `core/airlock.js`'s `push()` already stamps `ts: performance.now()` on the MAIN thread at capture time
  (before the worker round-trip) — this is byte-for-byte the same semantic as `sampleRUM`'s own `timeShift()`
  (page-relative `performance.now()`). So `connectors/helix-rum/map.js`'s `mapToRum` reads `event.ts` rather
  than re-deriving a timestamp inside the (off-thread) connector, and the AC2 "captured on the main thread"
  requirement is satisfied structurally by whichever caller eventually calls `push({ event: "top" })` — no
  PerformanceObserver/DOM read is needed for this checkpoint. This IS the connector-shape decision the slice's
  guardrail anticipated ("how the page-view checkpoint is captured/enqueued") — recorded here rather than
  silently assumed.
- **Endpoint-ceiling exact-match shape: the manifest declares the FULL `.../.rum/${weight}` URL, not a bare
  origin.** The slice's own prose (and this task's brief) describe the declared endpoint loosely as
  `endpoints: ["https://ot.aem.live"]`; `core/endpoint-ceiling.js`'s `checkEndpointCeiling` is an EXACT
  origin+pathname match (no prefix/wildcard), so a bare-origin declaration would not match the actual
  `https://ot.aem.live/.rum/100` runtime URL and the ceiling would **hold** every legitimate beacon (a
  false-positive block, verified by reading `core/endpoint-ceiling.js`'s `originPath`/`checkEndpointCeiling`
  this session). `connectors/helix-rum/connector.js` instead computes the declared endpoint and the runtime
  URL from the SAME `{collectBaseURL, weight}` (mirrors GA4's `endpoints` array being shared, byte-identical,
  between the manifest and `handle()`), so they always match exactly. "Pinned to `ot.aem.live`" (AC2's
  language) is satisfied at the granularity the real ceiling actually enforces (origin+path), not the origin
  alone — a precision fix, not a scope change.
- **Tests (targeted, per this slice's brief — full `vitest run` hangs on a stale worktree):**
  - `npx vitest run test/helix-rum-connector.test.js test/helix-rum-seam.test.js` → **22/22 passed** (16 +
    6). Covers: the grounded 5-field beacon shape (payload-hygiene by construction), the `.rum/${weight}` URL,
    `t` sourced from `event.ts`, the ephemeral 9-hex-char `id`, sampling honored (selected/unselected/weight:0,
    decided once at construction not re-rolled per `handle()`), at-most-one-request-per-call (no GA4-style
    fan-out), the manifest's `purposes.egress: []` declaration, hosted via `createConnectorHost`
    (ready/dropped shape), the "fires regardless of consent" contrast against an otherwise-identical
    purpose-governed beacon that IS held, an explicit consent DENIAL elsewhere on the page not touching the
    RUM path, and the endpoint ceiling holding a re-pointed/compromised destination (both a literal
    non-`ot.aem.live` URL and a connector reconfigured with an evil `collectBaseURL`).
  - Regression touch: `npx vitest run test/endpoint-ceiling-seam.test.js test/consent-seal.test.js
    test/egress-confinement.test.js` → **30/30 passed** (6 + 15 + 9), unchanged from before this slice — no
    `core/` file was modified (this slice is additive-only: a new `connectors/helix-rum/` + two new test
    files + this doc + `mvp4.md`).
  - `npx eslint connectors/helix-rum/ test/helix-rum-connector.test.js test/helix-rum-seam.test.js` → clean
    (repo's flat-config `recommended` ruleset, adopted 021-03).
- **Files created:** `connectors/helix-rum/connector.js`, `connectors/helix-rum/map.js`,
  `test/helix-rum-connector.test.js`, `test/helix-rum-seam.test.js`.
- **Files changed:** this slice file (Findings + this Deviation log); `docs/releases/mvp4.md` (the
  `helix-rum-js connector` Include row, noting 022-01 delivered the core beacon + naming 022-02/03 remaining).
- **No live identifiers:** every `id`/`referer`/endpoint in the tests and connector defaults is synthetic
  (`spike.example`, `evil.example`) or the AEM-public default (`ot.aem.live`); no real RUM ids or customer RUM
  base URLs are committed.

### Reconciliation sweep

- **Additive-only, no `core/` touched.** New `connectors/helix-rum/{connector,map}.js` + two test files;
  `git diff` shows zero `core/` changes (52/52 targeted + regression green, independently re-run).
- **Grounding verified by the orchestrator** (not just trusted): the exact-match ceiling works because
  `weight` is fixed once at construction, so manifest `endpoints[0]` === `handle()`'s runtime URL (both from
  the same `{collectBaseURL, weight}`); the not-consent-gated class is real on `core/airlock.js:163`
  (consent gate gated on `egressPurposes.length`) + `:194` (ceiling gated on `ceiling.length`) — confirmed by
  reading the seam. The seam test's **contrast** (identical beacon held under `egressPurposes:["analytics_storage"]`)
  makes the class distinction meaningful, not asserted.
- **mvp4.md** `helix-rum` Include row annotated "022-01 DELIVERED (core `top` beacon; 022-02/03 remaining)".
- **Open fork carried forward (not orphaned):** production/adapter wiring (a RUM-dedicated `createAirlock`
  instance with empty `egressPurposes`, page-view `push({event:"top"})` capture) is flagged in the deviation
  log for **022-02/03** — it mirrors alloy's current not-yet-page-wired state, not a new gap.
- **No orphaned refs:** the connector's manifest advisory `purposes.egress:[]` documents the class; the
  enforcement (caller wires no `egressPurposes`) is what the seam reads — the distinction is stated in the
  connector header + proven in the seam test.
- **eslint clean** under the 021-03 flat config (the new files fall under the browser/vitest globs correctly).
