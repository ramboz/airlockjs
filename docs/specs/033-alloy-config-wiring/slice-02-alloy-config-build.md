---
status: DONE
dependencies: [033-01]
last_verified: 2026-09-04
arch_review: true  # extends the public boot(config) surface + the config schema to a new (wrapped-SDK) connector.
frame_review: true  # re-framed on the landed spike design + ADR-0016; a new connector governance-class in the seam.
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->
<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions — never assert an unverified claim as fact. -->

## Slice 033-02 — build: config-boot alloy (the analytics vertical) — `{type:"alloy"}` in `boot(config)`

> **Reopened from DEFERRED (2026-09-04)** — 033-01 returned **GO** and **[ADR-0016](../decisions/adr-0016-alloy-stock-bundle-site-supplied.md)**
> (adopter-supplied `bundleUrl`; same-origin recommended, cross-origin supported) is Accepted. This slice is now the
> concrete build, **scoped by a SPIDR-Path split to the analytics vertical** (boot alloy from a config → one
> `sendEvent` → the intercepted interact dispatched). **Personalization / decisions-as-data → [033-03](slice-03-alloy-decisions.md)**
> (the follow-on vertical). Rationale: the combined build spans ~7 areas (worker CSP fix, adapter, dispatch,
> distribution, schema, consent, proof) across two independent user outcomes; the analytics vertical alone **closes
> MVP6's "GA4 + Adobe/alloy" config-surface gap** for the (dominant) analytics adopter.

**Goal:** make `boot({ connectors: [{ type: "alloy", bundleUrl, … }] })` boot Adobe/alloy through the wrapped-SDK
path for the **analytics** use — a `bootAlloy` adapter producing a composite-compatible handle; airlock's classic
alloy chamber worker fixed to load under the enforced EDS CSP and built as a 5th `dist` entry; the **adopter-supplied**
stock SDK loaded via `bundleUrl` (ADR-0016); `{type:"alloy"}` in the config schema + a golden fixture; the strict
seam consent gate; and an end-to-end proof (boot → one `sendEvent` → intercepted interact dispatched + ECID
write-back). Decisions-as-data (Target personalization) is explicitly **out of scope** → 033-03.

**DoR:**
- ✅ 033-01 **GO** (the recorded design) + **ADR-0016 Accepted** (the `bundleUrl` distribution decision).
- ✅ 032 DONE — `boot(config)` + `createComposite` + `bootConnector` + the config schema exist (the surface alloy plugs into).
- ✅ Extension points grounded (read 2026-09-04): `bootConnector(entry, governance, index)` is a `switch(type)`
  returning `{handle, events}` (`adapters/eds/index.js:965`); `KNOWN_CONNECTOR_TYPES` (`:862`); `createComposite` fans
  out via `acceptsEvent(events,name)` (`:775`,`:818`); `createWrappedSdkHost` returns `{init, driveEvent (single-slot,
  re-entry-guarded :440-445), getState}` — **no `dispose`, does not spawn the Worker** (`core/wrapped-sdk-host.js:429-454`);
  alloy `manifest.events = ["page_view"]`, `manifest.egress = ["analytics_storage","personalization"]`
  (`connectors/alloy/connector.js:95,121`); the strict gate is `egressVerdict(consent, egressPurposes, {strict:true})`
  (`core/wrapped-sdk-host.js:310`).

**Acceptance Criteria:**

1. **Worker CSP fix (the spike's ~4-line fix, productized).** `connectors/alloy/alloy-chamber.worker.js` installs its
   own Trusted Types policy and loads the stock bundle via `importScripts(policy.createScriptURL(bundleUrl))` (rather
   than the bare `self.importScripts` at `:377` that `fatal{phase:"load"}`s under a real CSP today). **PROOF:** a
   Playwright rig (promote the 033-01 probe shape into a real `rig:*`/test) loads the *built* classic alloy worker +
   a stub bundle under the enforced EDS boilerplate CSP and asserts it reaches `booted` (not `fatal{phase:"load"}`),
   with the 004-01 un-nonced-inline negative control. Regression: `has_dynamic_import === false` preserved (AD-7).
2. **`bootAlloy` adapter + a multi-event host.** `bootAlloy` (`adapters/eds/`) constructs the served classic alloy
   Worker (from the `dist` path) + triggers the **adopter-supplied** stock-SDK load via `bundleUrl` (ADR-0016;
   default a documented same-origin vendored path) + wires the caps (`egress.dispatch`, `cookies.reconcile`,
   `configIntegrity`, `endpointCeiling`, `consent`/`egressPurposes`) into `createWrappedSdkHost`, and returns a
   **composite-compatible handle** (`push`/`pushCritical`/`setConsent`/`dispose`/`getState`). **Two pieces the
   DoR-grounded host does NOT yet provide — both in scope for this slice:**
   - **N sequential events (host-side — ARCH-RELEVANT).** `createWrappedSdkHost.driveEvent` today dispatches its
     queued event **only on the one-time `phase:"configured"` message** (`core/wrapped-sdk-host.js:389`); a 2nd
     `driveEvent` on the retained chamber sets `queuedEvent` but is **never re-triggered → it hangs** (`:440-450`).
     033-02 **extends the host** so that post-`configured` `driveEvent` calls dispatch **immediately** (alloy is
     already configured) — enabling N sequential events, not just the one queued-on-configure event. This is a change
     to `core/wrapped-sdk-host.js` (the shared wrapped-SDK round-trip host) — **called out for the arch review**; it
     must not regress the existing single-event callers (the alloy rigs + `test/wrapped-sdk-host.test.js`; GA4 uses
     the separate fire-and-forget `core/chamber.worker.js` path, not this host).
   - **Adapter serialization + Worker ownership.** The adapter serializes `push`/`pushCritical`→`driveEvent` via a
     **sequential queue** so calls never overlap (the `driveEvent` re-entry guard at `:440-445` is respected — never
     two in flight), and **owns Worker construction + teardown** (`dispose()` terminates the Worker — the host has
     neither `dispose` nor Worker-spawn; honors the 021-01 dispose-no-leak invariant).
3. **`{type:"alloy"}` dispatch in `boot(config)`.** `bootConnector` gains a `case "alloy"` returning
   `{ handle: await bootAlloy({...}), events: ALLOY_MANIFEST_EVENTS }` (`["page_view"]`); `KNOWN_CONNECTOR_TYPES`
   gains `"alloy"`; entry validation requires `bundleUrl` (+ `datastream`/`edgeConfigId`). Consent is threaded via the
   connector's `manifest.egress` purposes (`analytics_storage` + `personalization`) into the host's `egressPurposes`
   with the strict `egressVerdict(strict)` seam gate (drop on a denied purpose). Composite fan-out is gated by
   `acceptsEvent` (alloy sees `page_view` only — no arbitrary site events leak to the interact).
4. **Distribution — 5th classic-IIFE `dist` entry (ADR-0016), incl. the build-assertion rework.** `build.mjs` emits
   airlock's classic alloy chamber worker via a **second esbuild `format:"iife"` call** — it **cannot** join the
   `format:"esm"` `WORKER_ENTRIES` call (it's a classic `importScripts` worker); the `core/`-rooted out-namer is
   generalized for a `connectors/alloy/`-rooted basename. **This is NOT just a second call + out-namer** (the earlier
   framing understated it): because `bootAlloy` (bundled into `eds.js`) references
   `new Worker(new URL("./alloy-chamber.worker.js", …))`, the build's **HARD-CONSTRAINT layout assertions must be
   reworked across BOTH build results** — the alloy specifier added to `EXPECTED_WORKER_SPECIFIERS`, its emitted
   output merged into `emittedBasenames` + the negative `blob:`/`data:`/`ajv` scans — **else the existing
   `build.mjs:124-137` sibling-resolution assertion FAILS** the moment `eds.js` carries that specifier. And
   `publish-dist.mjs`'s `DIST_ARTIFACTS` (derived from `WORKER_ENTRIES`, `:36-39`) must be **extended to include the
   alloy worker** — else it is omitted from the published `dist` and a consumer page **404s** it. The **stock bundle
   is NOT shipped** — `bootAlloy` loads it from `bundleUrl`; README documents the adopter-supplied prerequisite
   (same-origin recommended / cross-origin supported, per ADR-0016). The same-origin / no-`blob:` / no-`data:`
   invariant (004-01) is enforced for the alloy worker too — *by the reworked assertions*, not automatically.
5. **Config schema + docs.** `contracts/instrumentation-config.schema.json` gains the `{type:"alloy"}` branch in the
   discriminated union (required `bundleUrl` + `datastream`/`edgeConfigId`) + a **golden fixture** + a **negative
   fixture** (missing `bundleUrl`), wired into `contracts/validate.mjs`. README "Configure airlock" coverage line
   updated: alloy **analytics** now covered via the config surface (personalization tracked as 033-03).
6. **End-to-end proof (incl. the multi-event no-hang case).** A rig/test boots alloy from a `boot(config)` object,
   drives a `page_view`, and asserts the intercepted alloy **interact is dispatched via the seam** (+ ECID write-back
   through `cookies.reconcile`). It then drives a **second `page_view`** (the soft-nav case) and asserts **it too**
   reaches the seam — proving the AC2 host extension (no hang on event #2). Decisions-as-data delivery is explicitly
   out of scope (→ 033-03); the host continues to ignore `{type:"decisions"}` (no regression asserted).

**DoD:** all ACs pass; **TDD red→green**; reviewed (**compliance** + **craft** + **arch** [`arch_review: true` — new
connector on the public `boot(config)` + schema surface] + **frame-critique** [`frame_review: true`]); deviation log +
reconciliation sweep; reconciliation review; `docs/refinement-todo.md` alloy entry annotated (the **analytics**
config-surface gap CLOSED; personalization tracked as 033-03); board synced; **[ADR-0016](../decisions/adr-0016-alloy-stock-bundle-site-supplied.md)**
referenced for the `bundleUrl` distribution decision.

**Residual (carried forward — NOT retired here).** AC1/AC6's proof is **hermetic**: a *stub* bundle under the
*captured* boilerplate CSP. The **live-host Trusted-Types re-confirm + the real ~766 KB alloy bundle boot** (a
restrictive live-host `trusted-types <names>` directive is the only residual CSP risk — 033-01 Outcome + ADR-0016
kill-criteria) is a **deploy/creds-gated** step, tracked as a follow-up (like the 013 live-alloy re-probe). This slice
does **not** claim to retire it — the hermetic proof establishes the mechanism, not the live-host + real-bundle boot.

## Close-out

### Deviation log

**TRUSTED seam gates in `bootAlloy` (config-integrity + endpoint-ceiling) — wired, not deferred.** An initial cut
omitted `configIntegrity` + `endpointCeiling` from `bootAlloy`'s `createWrappedSdkHost(...)` call, reasoning the
server-directed egress breadth is creds-gated. The gating **compliance + arch** reviews correctly flagged this as a
1.0 **security regression**, not sound scoping — and it is now **fixed** (`adapters/eds/index.js` `bootAlloy`):

- **config-integrity (spec 015 / ADR-0011)** — the interact is pinned to `{ pinnedHost: "adobedc.demdex.net",
  tenantKey: "configId", pinnedTenant: <the host-owned datastreamId>, disposition: "hold" }`. This has **no
  enumeration problem** (it pins the TENANT, built from the `datastreamId` the config already carries), the threat is
  **confirmed-live** (013-03: the real Edge routes by `configId` on a single shared host), and it is **load-bearing
  precisely because ADR-0016 permits a cross-origin/untrusted adopter bundle** — a compromised bundle re-`configure`-ing
  or crafting its own `?configId=<attacker-org>` interact is now **HELD at the seam** (fail-closed), proven by
  `test/eds-boot-alloy.test.js` "a RE-TENANT interact … is HELD by config-integrity". The datastream id is therefore
  **required** (schema `anyOf` + `validateConnectorEntry` + a missing-datastream negative fixture).
- **endpoint-ceiling (spec 016 / ADR-0006)** — wired to the **grounded interact FLOOR** (`[ALLOY_INTERACT_ENDPOINT]`,
  origin+path). This is exactly the trade-off **016-02 AC3/AC5 already accepted**: ship the grounded origin as the
  enforced floor (which does NOT block the honest analytics interact — proven by the honest-regression test), and
  **HOLD + surface** the un-grounded server-directed breadth (demdex/ID-sync URLs the Edge *response* returns at
  runtime, which a static declaration can't enumerate) **fail-closed — NOT a silent drop**. Only the *breadth-grounding*
  is creds-gated (the live-Alloy follow-on, `docs/refinement-todo.md`); the floor is shipped and enforced now. Proven by
  `test/eds-boot-alloy.test.js` "an OFF-FLOOR destination … is HELD by the endpoint-ceiling".

**Craft nits recorded (non-blocking).** (a) `test/alloy-chamber-csp.test.js` proves the CSP fix by source-grep
(`createPolicy`/`createScriptURL` present) — presence, not runtime admission; the **real** admission proof is
`rig:alloy-csp` (PASS in a real browser: reaches `configured`, not `fatal{phase:"load"}`). (b) The
`CLASSIC_WORKER_ENTRIES`-declares-alloy assertion in `test/dist-build-publish.test.js` is a cheap tautology guard.
(c) `build.mjs`'s basename-only out-namer would collide on same-basename entries in different dirs — none today; noted
in a code comment. (d) `pushCritical` rides the same queued `driveEvent` (no sync sendBeacon fast path for the async
interact) — follow-on tracked.

**Follow-ons parked** in `docs/refinement-todo.md`: endpoint-ceiling breadth grounding (creds-gated live-Alloy);
`pushCritical` unload fast-path; optional config-integrity `disposition:"override"` opt-in; and (033-03) alloy
personalization / decisions-as-data.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `core/wrapped-sdk-host.js` | `updated` | AC2 host N-sequential-events extension (`configured` latch; post-`configured` `driveEvent` dispatches immediately). Reviewed race-free (craft) + invariant-preserving, alloy-only blast radius (arch). |
| `adapters/eds/index.js` | `updated` | `bootAlloy` (Worker construct+teardown, serial `driveEvent` queue, composite handle) + `case "alloy"` + `KNOWN_CONNECTOR_TYPES` + validation + the TRUSTED seam gates (config-integrity pin + endpoint-ceiling FLOOR + strict consent). |
| `connectors/alloy/alloy-chamber.worker.js` | `updated` | AC1 CSP fix (worker-realm TT policy + `importScripts(createScriptURL(bundleUrl))`); + runtime-assembled `data:` probe strings (build-scan false-positive workaround; probe behavior byte-identical — craft-verified). |
| `build.mjs` | `updated` | AC4 5th classic-IIFE `dist` entry (2nd `format:"iife"` build) + generalized basename out-namer + layout assertions reworked across BOTH build results (extend, not weaken the ESM-4 invariants). |
| `publish-dist.mjs` | `updated` | AC4 `DIST_ARTIFACTS` extended to include the alloy worker (else a consumer page 404s it). |
| `contracts/instrumentation-config.schema.json` | `updated` | AC5 `{type:"alloy"}` discriminated-union branch: required `bundleUrl` + a `datastreamId`/`datastream`/`edgeConfigId` `anyOf`. |
| `contracts/validate.mjs` | `updated` | AC5 wire the alloy golden + the two alloy negatives. |
| `contracts/fixtures/*.json` | `updated` | AC5 golden + `missing-bundleUrl` + `missing-datastream` negatives; repurposed the `unknown-type` negative (alloy→tiktok, since alloy is now known). |
| `README.md` | `updated` | AC5 "Configure airlock" — alloy **analytics** covered via the config surface + the adopter-supplied `bundleUrl` prerequisite ([ADR-0016](../decisions/adr-0016-alloy-stock-bundle-site-supplied.md); personalization → 033-03). |
| `docs/refinement-todo.md` | `updated` | alloy config-wiring entry: analytics config-surface gap **CLOSED** (033-02); follow-ons parked (033-03 personalization, ceiling-breadth grounding, `pushCritical` unload, override opt-in, live-host TT residual). |
| `package.json` | `updated` | the `rig:alloy-csp` script (the AC1 browser CSP proof). |
| `test/eds-boot-alloy.test.js` (new), `test/alloy-chamber-csp.test.js` (new), `test/wrapped-sdk-host.test.js`, `test/dist-build-publish.test.js`, `test/instrumentation-config-contract.test.js` | `updated` | AC1–AC6 tests incl. the re-tenant-HELD + off-floor-HELD security tests, the N-event no-hang, the e2e 2nd-`page_view`. |
| `rig/alloy-csp.mjs` + `rig/alloy-csp-harness.html` + `rig/alloy-csp-stub-bundle.js` (new) | `updated` | AC1 the promoted CSP browser proof (`rig:alloy-csp`, PASS — real-worker `importScripts` admitted under the enforced boilerplate CSP). |
| `docs/architecture.md` | `no-op` | the Contract-surfaces instrumentation-config note (032) is connector-agnostic ("`boot(config)` consumes"); alloy is now covered by the same surface — no per-connector enumeration to update. |
| `docs/specs/README.md` (board) | `deferred` | the 033-02 board row flips DRAFT/IN_PROGRESS→**DONE** at the DONE transition (close-out). |
| `docs/specs/033-alloy-config-wiring/spec.md` | `no-op` | the SPIDR split + decomposition were committed in `b2b5232` (`docs(033-02)`); the implementation did not touch it. |

### Definition of Done — verification
- [x] All 6 ACs pass; **TDD red→green**. `npm test`: **80 files, 1071 tests** (baseline 1036 → +35; +6 in the security fix-up round). Zero regressions.
- [x] `node build.mjs` OK (`all_workers_are_same_origin_file_urls: true`, alloy worker emitted); `node contracts/validate.mjs` all pass; `npm run lint` exit 0; **`rig:alloy-csp` PASS** (real-browser CSP admission).
- [x] Reviewed: **compliance + craft + arch** (`arch_review: true`) + **frame-critique** (`frame_review: true`) — all recorded pass (compliance + arch after one needs-changes round each; the security-cap gap was caught + fixed).
- [x] Deviation log + Reconciliation sweep produced; reconciliation review passed.
- [x] `docs/refinement-todo.md` alloy entry: analytics gap **CLOSED**; personalization tracked as 033-03. Board synced. [ADR-0016](../decisions/adr-0016-alloy-stock-bundle-site-supplied.md) referenced.
