---
status: DONE
dependencies: [044-01, 044-02, 045-01, 041-01, 032-02]
last_verified: 2026-09-14
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 048-01 — bootGoogleAds + worker chamber + `{type:"google-ads"}` config type + composite membership (consent-gated)

**Goal:** Make the spec-044 Google Ads connector reachable end-to-end by **hosting it in a dedicated worker chamber**
(mirroring what spec 041 did for ga4-gtag), then wiring a `bootGoogleAds` adapter + a `boot(config)`
`{type:"google-ads"}` type + composite membership over it, consent-gated (`egressPurposes:["ad_storage"]` +
`holdOnDenied`). End-to-end value: a real EDS page selects Google Ads **declaratively**
(`boot({connectors:[{type:"google-ads", …}]})`), its steady-state page-load AW beacon is mapped **off-thread in its own
chamber** and dispatched as a governed GET, and consent is enforced — a denied `ad_storage` beacon holds at the seal, a
granted one sends. Closes the 044-01 §A2 "real boot wiring in adapters/eds is the deferred edge" gap for the first ad
connector.

**Frame-critique correction (2026-09-14).** The DRAFT's original A1 — "boot on the main-thread `remap`/seal seam, no new
`connector:` chamber branch" — was **WRONG** and is retired. `connectors/google-ads/connector.js` is a gtag-family
`{ manifest, init, handle }` Connector "hosted the SAME way `core/connector-host.js` hosts GA4-gtag/pixel"
(`connector.js:92`, `createGoogleAdsConnector` at `:103`); its **steady-state** page-load beacon is mapped in a **worker
chamber**, exactly like ga4-gtag (`core/ga4-gtag-chamber.worker.js`). `createGoogleAdsRemap` covers only the seal's
held→grant-**flush** re-map (045), NOT the steady-state producer. `core/airlock.js` has no `google-ads` branch — an
un-branched boot falls through to the default GA4-MP `chamber.worker.js` and would emit the WRONG beacon. So this slice's
true scope includes the **chamber + core seam**, mirroring 041.

**Why `arch_review: true`.** This DOES add a core seam — a new `connector:"google-ads"` branch in `core/airlock.js` (Worker
URL selection at `:320`, init message, and the `requestMapper` case at `:247` for the unload/critical GET tail), a new
`core/google-ads-chamber.worker.js` + `core/confine-google-ads-chamber.js`, and a `build.mjs` bundle entry — plus a new
connector class on the `boot(config)` surface (`KNOWN_CONNECTOR_TYPES`, `adapters/eds/index.js:1600`). The arch pass
ratifies that this **mirrors the proven ga4-gtag chamber/boot (spec 041)** rather than inventing a new hosting model.

**DoR:**
- ✅ The connector + its seal opt-in are DONE: `connectors/google-ads/connector.js` is a `{manifest,init,handle}` gtag-family
  connector (044-01), with its `holdOnDenied` opt-in + `egressPurposes:["ad_storage"]` (044-02), proven through a REAL
  `createAirlock({ holdOnDenied, remap })` in `test/google-ads-seal.test.js` (which simulates the chamber's `ready` output
  via FakeWorker — i.e. it does NOT yet run a real google-ads chamber).
- ✅ There is a proven template to mirror: **spec 041** stood up `core/ga4-gtag-chamber.worker.js` +
  `bootGa4Gtag`'s `connector:"ga4-gtag"` branch (`core/airlock.js:247`, `:320`) + the `build.mjs` `ga4-gtag-chamber` entry +
  `bootConnector` dispatch — the exact chamber+boot shape this slice reproduces for google-ads.
- ✅ The seal machinery is DONE: `holdOnDenied` + the hold-until-granted re-map via the connector's `remap` (045-01).
- ⚠️ Assumption A1' (the chamber mirrors ga4-gtag with no NEW core mechanism) is the frame-critique's residual check; see
  `## Assumptions`.

**Acceptance Criteria:**

1. **A worker chamber hosts the Google Ads connector off-thread.** A new `core/google-ads-chamber.worker.js` hosts
   `createConnectorHost(createGoogleAdsConnector, config)` (mirroring `core/ga4-gtag-chamber.worker.js`), with a
   `core/confine-google-ads-chamber.js` egress-confinement first-import (mirroring `core/confine-ga4-chamber.js` —
   `withholdFetch`, since egress is the `ready` postMessage, not a chamber `fetch`), source-order-pinned. `core/airlock.js`
   grows a `connector === "google-ads"` branch: the Worker-URL selection (`:320`), the init-message shape, and the
   `requestMapper` case (`:247`, `createGoogleAdsConnector(connectorConfig).handle`) for the unload/critical GET tail.
   `build.mjs`'s `WORKER_ENTRIES` emits `core/google-ads-chamber.worker.js` (the N-worker sibling-layout guard covers it).
2. **A new `bootGoogleAds(opts)` adapter boots the chamber, consent-wired**, returning the standard boot handle
   (`{ push, pushCritical, setConsent, getState, flushNow, stats, dispose }` — a 7-key SUPERSET of `bootGa4Gtag`'s 6-key
   handle: it additionally exposes `pushCritical`, which is safe + intended because AC1 wires the `requestMapper` for the
   unload/critical GET tail and the composite guards `pushCritical` with a `typeof` check; matches the ADR-0017 frozen
   installed `window.airlock` surface. [Reconciliation 2026-09-14: corrected from the DRAFT's inaccurate "byte-shape-identical
   to bootGa4Gtag's" — the craft pass flagged the wording; the 7-key handle was the intended, tested shape.]) It
   constructs `createAirlock({ connector:"google-ads", connectorConfig:{ conversionId, ctx, endpoint }, endpoints:[the
   host-owned ceiling], egressPurposes:["ad_storage"], holdOnDenied:true, consent, onDiagnostic, remap })` — where **`remap`
   = `createGoogleAdsRemap({ conversionId, readCookieString: () => document.cookie })`** is the connector's held→grant-flush
   re-mapper (045-01, `test/google-ads-seal.test.js`). **This is a second axis the "mirror 041" template does NOT cover:**
   `bootGa4Gtag` wires no `holdOnDenied`/`remap`/`readCookieString` (grepped — no existing boot does), so `bootGoogleAds` is
   the FIRST adapter to thread the hold+remap+cookie-reader trio through a real chamber. Mirror 041 for the chamber-hosting
   axis; add the seal/remap axis here. Absent `consent` stays back-compat (no seal gate), exactly as the other boots gate on
   `consent`.
3. **`boot(config)` accepts `{type:"google-ads", …}`.** `google-ads` added to `KNOWN_CONNECTOR_TYPES`; the validator accepts
   a well-formed entry and rejects one missing its required id(s) (the exact set — e.g. `conversionId` — read off
   `connectors/google-ads/connector.js` + `cookies.js`, per A3), naming the connector by index; `bootConnector` dispatches
   `{type:"google-ads"}` to `bootGoogleAds` + composite with its manifest events; top-level governance threaded like
   `ga4`/`ga4-gtag` (not the helix-rum carve-out).
4. **Consent enforced END-TO-END through the boot, against the REAL seal.** Booting Google Ads with
   `consent:{ad_storage:"denied"}` + `holdOnDenied` HOLDS a beacon (zero `fetch`); a `setConsent({ad_storage:"granted"})`
   re-maps (via `createGoogleAdsRemap`) + flushes it — the `test/google-ads-seal.test.js` proof, now driven through
   `bootGoogleAds` (FakeWorker harness for the seal, which is main-thread).
5. **The steady-state beacon is proven through the REAL chamber (not only a FakeWorker `ready` simulation).** A rig proof
   (mirroring `rig/e2e` / `rig:isolation` for the existing chambers, run against the real `npm run build` output + a real
   browser Worker) shows a config-booted Google Ads connector's page-load beacon egressing as the expected governed GET
   through its actual `core/google-ads-chamber.worker.js` — closing the frame-critique's "FakeWorker hides the missing
   chamber" gap. (Vitest stays FakeWorker-based per repo norm; this AC is the real-Worker rig arm.) **Named residual
   (frame-critique re-run):** this rig arm proves the GRANTED steady-state GET; the held→remap→flush path stays
   FakeWorker-proven (AC4), so the real-chamber + hold + remap *combination* is verified by source inspection
   (`core/connector-host.js` preserves `event`; `core/airlock.js` buffers `r.event` for re-map, 045-01), not exercised
   end-to-end — extend the rig arm to a held→grant flush if that combination later needs a live witness.
6. **Back-compat + inspector-observable.** A `boot(config)` with no `google-ads` connector is byte-unchanged; a boot with
   no `consent` sends as today; `bootGoogleAds` threads `opts.onDiagnostic` (spec 028) so a prod-booted instance's
   held/dropped decisions reach the inspector collector (wired-collector regression assertion, per `test/eds-boot-inspector.test.js`).

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions); `npm run build` emits the new sibling; the rig proof (AC5) passes.
- [ ] Implementer test coverage exercises each AC; the held→granted→flush edge + the `KNOWN_CONNECTOR_TYPES` acceptance + the build-sibling guard are explicit.
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore) — in particular the denied-holds / granted-sends assertions and the missing-chamber-branch case (an un-branched boot must NOT silently pass).
- [ ] Reviewed by `reviewer` subagent (compliance) + craft pass + arch pass (`arch_review: true`) + this frame-critique.
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed; an ADR written if the chamber/boot addition is ratified as load-bearing with rejected alternatives (arch call — likely the 041 analogue).
- [ ] `docs/refinement-todo.md` updated for any deferred decision; the manifest `purposes`/`endpoints` mirror-drift residual noted, not silently widened.

## Assumptions

- **A1' (load-bearing, post-correction) — the google-ads chamber+boot mirrors ga4-gtag (spec 041) with NO new core
  MECHANISM.** The frame-critique established the connector IS a worker-chamber gtag-family connector; the residual
  assumption is that hosting it needs only the SAME seam ga4-gtag uses (`connector:` branch + a `*-chamber.worker.js` +
  confinement first-import + `requestMapper` case + `build.mjs` entry), with no new core primitive. Grounded by the ga4-gtag
  precedent (`core/ga4-gtag-chamber.worker.js`, `core/airlock.js:247`/`:320`, the 041 boot). The implementer confirms the
  google-ads `handle`'s `EgressRequest[]` shape is `requestMapper`-compatible (as ga4-gtag's is, `core/airlock.js:248`).
- **A3 — the required config id set** for a `{type:"google-ads"}` entry (e.g. `conversionId`) is read off
  `connectors/google-ads/connector.js` + `cookies.js` during implementation, not invented in this slice.

### Deviation log (after reconciliation)

Original ACs preserved above; deviations append here (2026-09-14).

- **Frame-critique re-scope (biggest).** The DRAFT's load-bearing A1 (boot on the main-thread `remap`/seal seam, NO worker
  chamber) was **wrong** — the pre-implementation frame-critique caught it: `createGoogleAdsConnector` is a gtag-family
  `{manifest,init,handle}` worker-chamber connector, and an un-branched boot would fall through to the default GA4-MP
  chamber and emit the wrong beacon. Re-scoped (pre-implementation) to a worker chamber + a `core/airlock.js` `connector:`
  branch + a `build.mjs` entry, mirroring spec 041; the re-run frame-critique passed. Evidence: `reviews/slice-01-frame-critique.md`.
- **`consentDefault` parity bug (compliance).** `bootGoogleAds` folded `consentDefault` into the steady-state ctx but
  dropped it from the `createGoogleAdsRemap(...)` call, so a held→grant-flushed beacon's `gcd` could diverge from a
  steady-state granted one. Fixed at the call-site (the connector's `createGoogleAdsRemap` already accepted it) + a
  non-vacuous "gcd PARITY" test (red-on-revert). Evidence: `reviews/slice-01-compliance.md`.
- **Pinned schema not updated (arch [blocker]).** `contracts/instrumentation-config.schema.json` lacked a
  `googleAdsConnector` `$def`, so the pinned schema REJECTED a `{type:"google-ads"}` config the runtime accepts — inverting
  the "schema is the fuller pinned reference" invariant + breaking the 041 precedent. Fixed: added the `$def` + `oneOf`
  entry (mirroring `ga4GtagConnector`) + a `KNOWN_CONNECTOR_TYPES`↔schema **cross-check test** so the drift can't silently
  recur (covers 048-02). The prior implementer's deferred residual in `refinement-todo.md` was struck RESOLVED. Evidence:
  `reviews/slice-01-arch.md`.
- **Rig-harness flake (compliance nit).** `rig/google-ads-chamber-harness.html`'s `onmessage` finalized the result before
  the dispatch `fetch` resolved; made `onmessage` `async` + `await Promise.all(fetches)`. `rig:google-ads-chamber` PASS.
- **AC2 wording corrected.** "byte-shape-identical to `bootGa4Gtag`'s" was inaccurate (the craft pass flagged it); the
  handle is an intentional 7-key SUPERSET (adds `pushCritical`). AC2 text corrected above; handle shape unchanged.
- **Smaller deviations (implementer):** `conversionId` is the only required id (grounded off the connector); `egressPurposes`
  is gated on `consent` (followed AC prose, mirroring `bootGa4Gtag`, not the illustrative unconditional snippet); `remap`
  additionally threads `endpoint` (defensive — an endpoint override without a matching remap endpoint would hold every
  grant-flush forever at the ceiling).
- **ADR call: DECLINED (no new ADR).** The chamber/boot addition applies already-ratified decisions — 041 chamber-hosting +
  ADR-0023 hold-until-consent + 044/§A5 connector/cookie discipline; the rejected main-thread-only alternative is already
  recorded in the frame-critique + spec `## Assumptions`. A dedicated ADR would restate ratified choices with no new fork
  (arch-pass call, `reviews/slice-01-arch.md`).

### Reconciliation sweep

Drift-prone surfaces checked (updated / no-op / deferred):

- `docs/architecture.md` — **updated**: added `google-ads-chamber.worker.js` to the chamber runtime list, and noted
  `connectors/google-ads/` is now chamber-hosted + bootable (`bootGoogleAds` / `type:"google-ads"` config + schema `$def`).
- `contracts/instrumentation-config.schema.json` — **updated**: `googleAdsConnector` `$def` + `oneOf` (fix round).
- `docs/refinement-todo.md` — **updated**: the schema-lags-runtime residual struck RESOLVED (fix round).
- `docs/specs/README.md` (status board) — **updated**: regenerated on transition (+ at DONE).
- Within-spec re-scope ripples (from the frame-critique) — **updated**: `spec.md` (§A1 marked RESOLVED, §A2/§Decomposition
  corrected to the worker-chamber reality) and `slice-02-floodlight-boot.md` (forward-references realigned to "048-01
  ratified the chamber+boot pattern"). Within the spec directory, not external drift surfaces — called out here for completeness.
- `docs/inbox.md` — **no-op**: no 048-relevant parked items.
- `CLAUDE.md` primer / spec-025 close-out — **deferred**: 048-01 does NOT close spec 048 (048-02/03 remain), so no
  compress-on-close-out yet. (The hot cache's stale "MVP7 focus" is a broader `/jig:memory-sync` item, out of this slice's scope.)
- Manifest `purposes`/`endpoints` mirror-drift residual — **no-op**: pre-existing tracked residual, not widened here.
- Lightweight decisions / conventions — **no-op**: no UI/copy/visual or rule changes.
- Memory-sync — the load-bearing learning (ad connectors are worker-chamber gtag-family; boot = mirror 041) is captured in
  the spec `## Assumptions`, `architecture.md`, and this deviation log; no new glossary term needed.

### Named residuals (carried forward)

- **AC5** — the real-chamber rig proves the GRANTED steady-state GET live; the held→remap→flush-**through-the-real-chamber**
  combination stays FakeWorker + source-inspection verified (disclosed in the rig + `refinement-todo.md`).
- **Cross-check test coupling** — the `KNOWN_CONNECTOR_TYPES`↔schema guard parses the runtime error string (the const isn't
  exported); a message reword could break it (nit, logged).
- **Optional test-strengthening** — a positive-parity `gcd` assertion (denied-all `consentDefault` → same non-null `gcd` on
  both paths) would harden the parity claim in the emit direction (enhancement, not a defect).
