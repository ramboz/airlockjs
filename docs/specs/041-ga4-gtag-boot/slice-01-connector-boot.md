---
status: DONE
dependencies: [039-01]
last_verified: 2026-09-09
frame_review: true
arch_review: true
---

## Slice 041-01 — gtag connector boots + egresses (Connector wrapper + chamber + createAirlock branch + minimal boot)

**Goal:** Make the dormant GA4 gtag connector *runnable*: a `Connector`-conforming wrapper, a worker chamber that hosts
it, a `createAirlock` selection branch, its `build.mjs` worker entry, and a minimal `bootGa4Gtag` in the EDS adapter that
sources `cid`/`sid` and wires the consent seal — so a page's `page_view` fires a real `/g/collect` GET (`v`/`tid`/`cid`/
`sid`) through the governed chamber → connector-host → dispatch path.

**Blocked-on:** 039-01 (the pure `createGa4GtagConnector` + `mapToGtagCollect`). DONE.

## Current state (grounded)

- `createGa4GtagConnector` (`connectors/ga4/gtag.js:321-340`) returns `{ handle }` ONLY — no `manifest`, no `init`. Its
  `handle(event)` returns `[{ url, method: "GET" }]` (contract-shaped `EgressRequest[]`).
- `core/connector-host.js:40-89` hosts a `{ manifest, init, handle }` `Connector` (reads `connector.manifest` at `:89`,
  calls `init` at `:55-61`, `routeBatch` → `{ready,dropped}`).
- The `createAirlock` seam (`core/airlock.js:239-258`) has no `"ga4-gtag"` branch; `build.mjs WORKER_ENTRIES:62-67` has
  no gtag chamber; `adapters/eds/index.js` has no gtag boot fn.
- Precedents to mirror exactly: `connectors/ga4/connector.js:72-157` (wrapper), `core/pixel-chamber.worker.js:42-76` +
  `core/confine-pixel-chamber.js:28` (chamber + `withholdFetch:true`), the pixel branch in `core/airlock.js:239-258`,
  `bootPixelConnector` (`adapters/eds/index.js:527-562`) for the `connector`/`connectorConfig` seam, and `bootGa4Core`
  (`:365-476`) for `sourceGa4Ctx` + the consent-seal params.

## The load-bearing question (why `frame_review: true`)

**A hosted connector is constructed ONCE** (`connector-host.js:44` — `factory(config)` at init), with `config.ctx`
frozen at that moment. gtag reads identity/consent/session-state from `config.ctx` INSIDE the worker
(`gtag.js:251-292`). For **041-01's boot-time snapshot** (`cid`/`sid`/boot-consent) this is fine — they are known at
boot. **But** gtag's Consent-Mode (`gcs`/`gcd`) and session-state are inherently time-varying (a consent update, a
session transition), and airlock's `setConsent` updates the **main-thread** seal + flushes held beacons — it does NOT
today push a new `ctx` into the in-worker connector. The frame-critique must decide: is a **boot-snapshot `ctx`** the
right frame for 041-01 (with consent-update / session-transition carriage into the worker deferred to a later slice as
a documented limitation), or does the connector-host model need a ctx-update seam before gtag can boot honestly? This
slice ASSUMES boot-snapshot is a legitimate, honestly-scoped first cut; the adversarial pass tests that.

**Acceptance Criteria:**

1. **gtag connector is a `Connector`.** `createGa4GtagConnector(config)` returns `{ manifest, init, handle }` (today
   `{ handle }`). `manifest` mirrors `createGa4Connector`'s (name e.g. `airlock/ga4-gtag`, `events: ["*"]`, `reads: []`,
   `capabilities: { cookies: ["_ga", "_ga_"], egress: true }`, advisory `endpoints: [GA4_GTAG_COLLECT_ENDPOINT]`,
   `purposes.egress: ["analytics_storage"]`). **The manifest comment must record gtag's OWN analytics-only rationale,
   NOT inherit `createGa4Connector`'s "no ads/personalization signal it emits" wording (frame-critique note):** gtag's
   beacon DOES carry `gcs`/`gcd` — but those COMMUNICATE consent decisions (state carriage), they do not PERFORM ad
   egress; the beacon itself is analytics, egressing under `analytics_storage`. This is where gtag materially diverges
   from MP, so the rationale is stated explicitly, not borrowed. `init(_caps)` is a synchronous no-op (ctx arrives via
   `config`, contract-conformance only, exactly like `createGa4Connector:131-133`). `handle` is UNCHANGED. A unit test hosts it through `createConnectorHost`
   and asserts `routeBatch` yields the `/g/collect` GET.
2. **A gtag chamber worker hosts it.** New `core/ga4-gtag-chamber.worker.js` (mirror `core/pixel-chamber.worker.js`):
   first-import a new `core/confine-ga4-gtag-chamber.js` calling `applyEgressConfinement(self, { withholdFetch: true })`
   (gtag is GET/postMessage-egress like pixel — never fetches in-worker), then on `{type:"init"}` strip the discriminant
   and `createConnectorHost(createGa4GtagConnector, config)` + `host.init({})`, on `{type:"events"}` →
   `routeBatch` → `postMessage({ ready, dropped })`.
3. **`createAirlock` selection branch + build entry.** Add `connector === "ga4-gtag"` → `new Worker(new
   URL("./ga4-gtag-chamber.worker.js", import.meta.url), { type: "module" })` (`core/airlock.js:239-246`) and include
   `"ga4-gtag"` in the verbatim-`connectorConfig` init-message condition (`:254-258`) — so it posts `{ type: "init",
   ...connectorConfig }` (NOT the GA4-MP `{trackers,workFactor,endpoints,ctx}` shape). Add the worker to `build.mjs
   WORKER_ENTRIES` (`:62-67`) + `EXPECTED_WORKER_SPECIFIERS` (`:118`) so the bundle-layout assertion passes.
4. **A minimal `bootGa4Gtag` in the EDS adapter.** `adapters/eds/index.js`: source `ctx` via `sourceGa4Ctx` (gated on
   `analytics_storage` grant, exactly `bootGa4Core:382,390-396`), then `createAirlock({ connector: "ga4-gtag",
   connectorConfig: { measurementId, ctx, endpoint: GA4_GTAG_COLLECT_ENDPOINT }, endpoints: [GA4_GTAG_COLLECT_ENDPOINT],
   ctx, consent, egressPurposes: consent ? ["analytics_storage"] : [], consentStrict, payloadDenylist })`. The endpoint
   ceiling is `/g/collect`, NOT the MP `DEFAULT_ENDPOINTS`. Returns the same window-handle shape `bootGa4Core` does.
   (Session-state + `gcs`/`gcd` ctx.consent fold are 041-02; batching is 041-03; declarative config is 041-04 — this
   slice is the boot-happy-path skeleton.)

**DoD:**
- [x] All ACs pass; full suite green (95 files / 1449 tests).
- [x] Coverage: the connector hosts through `createConnectorHost` and yields the `/g/collect` GET (AC1); the chamber
      worker's init→events→{ready,dropped} glue (mirrors the pixel chamber test); `createAirlock({connector:"ga4-gtag"})`
      selects the gtag worker + posts the verbatim-`connectorConfig` init (a FakeWorker test); `bootGa4Gtag` sources ctx
      + calls `createAirlock` with the `/g/collect` ceiling and a `page_view` egresses a GET carrying `v`/`tid`/`cid`/
      `sid`; the build bundle-layout assertion passes with the new worker entry; **plus the `workerMappedGetEgress`
      neutralization: a ga4-gtag airlock wires NO unload listeners (ring tail dropped, not mis-mapped) and `pushCritical`
      drops+diagnoses.**
- [x] Each new-feature test shown to fail when its feature is removed.
- [x] Reviewed by `reviewer` (compliance + craft + arch — all PASS; new egress-confined worker boundary + a
      connector-selection branch).
- [x] Deviation log + reconciliation sweep produced.

## Assumptions

- **Boot-snapshot `ctx` is a legitimate first cut (the frame's load-bearing bet — see "The load-bearing question").**
  041-01 sources `cid`/`sid` (+ boot consent) once at boot; time-varying consent-update / session-transition carriage
  INTO the worker connector is explicitly deferred (041-02 handles the initial session-state + consent fold; live
  UPDATES after boot, if needed, are a tracked follow-up, not this slice). **This inherits an ALREADY-ACCEPTED, tracked
  residual, not a fresh bet:** the worker `ctx` is a boot-time structured-clone snapshot (the deferred 017-01 worker
  `ctx` re-send — `core/airlock.js:589` "stays deferred", `docs/refinement-todo.md:222-232`), and the shipped GA4-MP
  connector lives under the same freeze (its `cid`/`sid` are equally boot-frozen; `setConsent` updates the main-thread
  seal live, not the worker connector). Not a dead-end — gtag's `handle` is a pure mapper closing over `ctx`
  (`gtag.js:335-337`), so a future ctx re-injection (a new worker message type) is lossless. If the frame-critique finds
  boot-snapshot dishonest for even the initial beacon, re-frame.
- **gtag is GET-egress → the pixel confinement posture (`withholdFetch: true`) applies verbatim** (grounded: gtag
  `handle` returns `{method:"GET"}`, no in-worker fetch; identical to pixel). Confirmed against
  `core/confine-pixel-chamber.js` at implementation.
- **The manifest's `purposes.egress` is `analytics_storage` only.** The beacon fires under analytics consent; `gcs`/
  `gcd` are ad-signal STATE carriage, not separate egress purposes (mirrors `createGa4Connector`'s analytics-only
  purpose annotation). Confirmed against ADR-0007's purpose model.

## Anti-horizontal-phasing check

After this slice a real EDS page can call `bootGa4Gtag` and its `page_view` reaches `/g/collect` as a governed,
off-thread GET — the connector is RUNNING end-to-end (page → chamber → host → seal → dispatch → fetch), not an internal
layer. Later slices enrich the payload (041-02), batch it (041-03), and make it declaratively selectable (041-04).

### Deviation log (after reconciliation)

Implemented across `connectors/ga4/gtag.js` (Connector wrapper), `core/ga4-gtag-chamber.worker.js` +
`core/confine-ga4-gtag-chamber.js` (new chamber), `core/airlock.js` (the `ga4-gtag` branch + the `workerMappedGetEgress`
predicate), `build.mjs` (worker entry), `adapters/eds/index.js` (`bootGa4Gtag`), + 4 new test files. All three gating
passes (compliance + craft + arch) PASS. Deviations and review-driven fold-ins:

1. **`bootGa4Gtag`'s handle omits `pushCritical` + interaction/exposure/block capture wiring (compliance+craft ruled
   COMPLIANT).** This deviates from a literal "same window-handle shape as `bootGa4Core`", but is correct: gtag is
   worker-mapped GET-egress with NO main-thread critical mapper, so exposing `pushCritical` would route through the
   unconditionally-constructed GA4-MP `critical` dispatcher (`mapToMp` → POST) and mis-map onto the GET-only
   `/g/collect`. Mirrors `bootPixelConnector`/`bootMetaPixel`, which omit `pushCritical` for exactly this reason.
2. **The unload/ring-tail mis-map was neutralized by generalizing pixel's AC10 guard to gtag (compliance+craft+arch
   ruled COMPLIANT).** `core/airlock.js` now gates BOTH mis-map entry points on `workerMappedGetEgress` (`= connector
   === "pixel" || connector === "ga4-gtag"`): the unload listeners are NOT wired (ring tail DROPPED at teardown — a
   bounded, disclosed unload-loss, same as pixel), and `pushCritical` drops+diagnoses. This is NOT a mis-map (the
   first-pass disclosure that called it one was corrected). The CORRECT unload-critical flush — a GET-shaped critical
   dispatcher so the ring tail egresses rather than dropping — is the tracked follow-up shared with pixel (recorded in
   `docs/refinement-todo.md`).
3. **Spec-frame inaccuracies (arch note, no code impact):** AC3 referenced adding to `EXPECTED_WORKER_SPECIFIERS`
   (`build.mjs:118`), but that set is auto-derived from `WORKER_ENTRIES` — adding the entry alone sufficed. And
   `egressPurposes` reuses the shared `GA4_EGRESS_PURPOSES` const (`["analytics_storage"]`) rather than the AC's inline
   literal — semantically identical, correct reuse.
4. **Doc-drift fixed (all three reviewers):** the stale `bootGa4Gtag` "KNOWN RESIDUAL" comment (`adapters/eds/index.js`,
   written before the `workerMappedGetEgress` fix) and the `core/airlock.js:181` `connector !== "pixel"` parenthetical
   were corrected to match the shipped gate.

**No deviation from:** the Connector-wrapper shape, the pixel-mirrored egress-confined chamber, the connector-selection
branch (static-literal worker URL + verbatim `connectorConfig`), the `/g/collect` ceiling, the analytics-only manifest
purpose (gtag's own rationale), or the boot-snapshot-ctx frame (the accepted 017-01 residual).

### Reconciliation sweep

- **`docs/refinement-todo.md`:** added the GET-shaped unload-critical dispatcher follow-up (a class-level item — pixel
  AND ga4-gtag both drop their ring tail at teardown for lack of a GET critical dispatcher; `createCriticalDispatcher`
  is POST/`mapToMp`-only). This generalizes pixel's already-disclosed "unload-critical GET dispatch is a later slice."
- **Intentional disclosed duplication:** `core/confine-ga4-gtag-chamber.js` + `core/ga4-gtag-chamber.worker.js` are
  near-verbatim pixel siblings; the pixel confine comment already flags folding all `confine-*-chamber.js` into one
  shared module as a later (026-02) item — this third copy extends that disclosed deferral, not new divergence. No new
  entry needed.
- **Noticed, out-of-scope (not fixed):** a pre-existing stale line-ref in `bootMetaPixel`'s doc comment
  (`adapters/eds/index.js:691` cites `core/airlock.js:277-280` for the unload wiring, now ~:513-516) — unmodified
  pixel-boot line, outside this slice's surface. Left for a future pixel-doc touch.
- **`docs/inbox.md`:** nothing new to park.
- **Framing-phase artifacts (no-op at reconciliation):** `docs/specs/041-ga4-gtag-boot/spec.md` (the FRAMED marker +
  slice links) and this slice file's rename from the reserve stub `slice-01-tbd.md` → `slice-01-connector-boot.md` are
  framing edits, not implementation collateral — noted for a complete sweep.
- **Downstream:** 041-02 (session-state + consent) / 041-03 (coalesce) / 041-04 (config selection) build on this boot fn,
  as framed. `docs/architecture.md` connector inventory + the config schema are touched by 041-04's close-out.
- **Full suite:** 95 files / 1449 tests green.
