---
status: DONE
dependencies: []
last_verified: 2026-09-02
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 026-01 — Meta Pixel through the generic connector, governed + dispatched (the archetype proof)

> **Reframed 2026-09-02 after the frame-critique (FAIL → reframe, maintainer-ratified).** The first draft claimed
> a Meta `/tr` GET pixel "rides the existing seam with **zero core changes**, governed end-to-end." Verified
> false in source: airlock's **dispatch** is POST-hardcoded (`core/airlock.js:201` / `:363` ignore
> `EgressRequest.method`, though the contract defines it at `contracts/connector.d.ts:63`) and
> **connector-selection** is GA4-hardcoded (`core/chamber.worker.js:46,62`; `core/airlock.js:148` worker URL) —
> and dispatch is explicitly **OQ10** (`connector.d.ts:21-24`). Only the seal's **governance verdicts**
> (consent / ceiling / PII-strip) are method-agnostic and ride free. So 026-01 **ships a real Meta `/tr` GET
> end-to-end by generalizing two bounded core seams** (resolving OQ10 for GET pixels), and **withdraws** the
> zero-core-change claim.

**Goal:** Ship one real vendor pixel — **Meta Pixel**, its `facebook.com/tr` image-**GET** wire form — end-to-end
through airlock: expressed as a **declarative config** against a new vendor-neutral `createPixelConnector(config)`,
**dispatched as a real GET** and **governed** by the existing seal. To get there, build the two **bounded,
generally-useful** core generalizations the multi-vendor pixel archetype needs — a **connector-selection seam**
(so a non-GA4 connector reaches a chamber) and **method-aware dispatch** (honor `EgressRequest.method` → GET) —
which together **resolve OQ10 for the GET case**. The seal's governance **verdicts** stay unchanged (a GA4
regression test proves it). This proves 026's net-new machinery (the declarative-map interpreter) on one real,
shippable vendor before 026-02 generalises across vendors.

> **Wire form, not the SDK.** Fires the `/tr` beacon `fbevents.js` emits, directly as config, **without loading
> `fbevents.js`** — a wire-protocol job (govern+schedule), not a worker-dom / wrapped-SDK / 025 job.

> **Identity honesty (frame-critique #3).** 026-01's beacon carries **NO identity** — `id` + `ev` + non-PII
> `event.params` only. That excludes **both** advanced matching (`ud[...]` hashed email/phone) **and basic
> first-party cookie identity** (`_fbp` / `fbc`) that a fully-attributing real hit carries. So the shipped beacon
> is **real and dispatchable but de-identified** — Meta accepts `/tr` GETs without `_fbp` (attribution is just
> weaker). Basic cookie identity is a **chamber cookie-capability** question → a follow-up slice; advanced
> matching → 026-03. Neither is swept under a vague "advanced matching" deferral this time.

**DoR (grounded 2026-09-02 — recon + frame-critique source verification):**
- ✅ Wire-protocol connector contract: `handle(event) → EgressRequest[]`, hosted by `core/connector-host.js`
  (`createConnectorHost`). GA4 (`connectors/ga4/`) is the exemplar; `mapToMp` / `mapToRum` are **bespoke code** —
  the declarative-map interpreter is net-new.
- ✅ **Seal governance verdicts ride free (method-agnostic):** consent gate (`core/airlock.js:163`), endpoint
  ceiling (`:194`), `governParams` (`:73-85`) gate on `{url, body/params}` + host config, **not** on method or
  connector identity. A GA4 regression test proves they are unchanged.
- ✅ **The two seams 026-01 generalizes (frame-critique-verified in source):**
  - **Dispatch is POST-hardcoded.** `core/airlock.js:201` (steady-state) + `:363` (held-beacon flush) do
    `fetch(url, { method: "POST", body })` and never read `r.method` — yet `method?: "POST" | "GET"` is defined
    (`connector.d.ts:63`) and dispatch is explicitly **OQ10** (`:21-24`, `:58-59`). 026-01 makes these
    method-aware (GET → no body) — **plus `airlock.js:176`**, where the held-beacon record is built as
    `{ url, body }` and **drops `method`** (frame-critique #2b): the record must **capture `method`** or a
    consent-held GET can never flush as a GET (AC6's exact path). So the method-aware change set is **three**
    sites: `:176` (record), `:201` (steady dispatch), `:363` (flush).
  - **Connector-selection is GA4-hardcoded — and the GA4 critical/unload path is *unconditionally* wired
    (frame-critique #2a).** `chamber.worker.js:46,62` import + host `createGa4Connector`; `airlock.js:148`
    hardcodes `./chamber.worker.js`; the init message `:149` is GA4-shaped (`{trackers, workFactor, endpoints,
    ctx}`); `createAirlock` (`:39-50`) takes no factory. **Critically, `airlock.js:118` unconditionally builds
    the GA4 critical dispatcher** (`createCriticalDispatcher` → hardcodes `mapToMp`, `egress.js:65`) and wires it
    to unload (`:277-280` → `unloadFlush` `:263-270`) — so a pixel event still ring-resident at
    `visibilitychange`/`pagehide` would be **GA4-`mapToMp`-mapped and POSTed to `facebook.com/tr`**. 026-01's
    selection seam therefore must (a) add a `pixel-chamber.worker.js` hosting `createPixelConnector` via
    `createConnectorHost` (mirroring alloy's own chamber worker, `chamber.worker.js:5`), selected through a new
    `createAirlock({ …, connector | worker })` option that also generalizes the init message `:149`; **and (b)
    make the GA4 *unload wiring* (`:277-280`) connector-conditional — NOT wired for a pixel instance** (unload-GET
    dispatch for pixels is a later slice, so a pixel event still ring-resident at unload is *dropped* — an
    unload-loss deferred, bounded + disclosed, not "fire-and-forget"). **Minimal-neutralization note:** `:277-280`
    (the unload *wiring*) is the actual mis-map source, so gate only that — leave `:118` constructing `critical`
    so the `stats()` (`:390`) / `pushCritical` (`:333-340`) call sites need no null-guards (a normal pixel event
    is not `pushCritical`-critical, so the constructed-but-unwired GA4 `critical` is never hit for a pixel). This
    neutralizes the mis-map *in code*, not just in prose. `egress.js` (the GA4 critical impl) is left
    **unchanged** — neutralized by not-wiring. GA4's default path is untouched (regression-tested).
- ✅ Meta `/tr` wire form is public + documented: `GET https://www.facebook.com/tr?id={pixelId}&ev={event}&…`.
  **Synthetic pixel id only; no live beacon fired** (asserted on a dispatch spy).
- ⚠️ **The declarative-map interpreter does not exist** — 026-01 builds it. Frame-critique residual bet: is a
  *data* map expressive enough for Meta's `/tr` shape without a code escape? (Meta `/tr` is flat query params —
  the friendliest first case; 026-02's vendors stress it.)

**Acceptance Criteria:**

1. **Vendor-neutral `createPixelConnector(config)`** at `connectors/pixel/connector.js`: `handle(event)` →
   `EgressRequest[]` by interpreting a **declarative config** `{ endpoint, eventMap, paramMap }` (+ manifest
   inputs) with **no vendor-specific code in the connector**. Meta specifics live in a config fixture. `init` no-op.
2. **Meta maps to a correct GET `EgressRequest`.** A `PageView` + one custom event (`Lead`) produce
   `{ method: "GET", url: "https://www.facebook.com/tr?id={synthetic}&ev={mapped}&…" }` with **no body**, params
   projected per the declarative `paramMap`. Table-driven (asserts the interpreter-on-config, not hardcoded output).
3. **Connector-selection seam.** `createAirlock` hosts `createPixelConnector` (via the pixel chamber worker /
   selector) instead of the hardcoded GA4 chamber; **GA4's default path still works** (regression test — GA4
   selection unchanged when no selector is given).
4. **Method-aware dispatch (resolves OQ10 for GET) — three sites.** The steady-state (`airlock.js:201`) +
   held-flush (`:363`) dispatchers honor `EgressRequest.method` (GET → **no body**), **and the held-beacon record
   `:176` captures `method`** (else a held GET can't flush as a GET — frame-critique #2b). A POST connector (GA4)
   is dispatched exactly as before (regression test). Asserted via a `fetch` spy — no live network.
5. **The beacon ships end-to-end.** Through the real path (event → chamber → `createPixelConnector.handle` →
   seal → dispatcher), a governed Meta `/tr` **GET is actually dispatched** (the fetch spy sees a GET to
   `facebook.com/tr` with the mapped query). This is the vertical proof the withdrawn "zero-core" AC replaced.
6. **Seal binds — consent-gated, and the flush is a GET.** Manifest `purposes.egress: ["ad_storage"]` + a
   matching `egressPurposes` wired for Meta in the adapter. Consent absent → **held at seal** (`:176` record,
   with `method` captured per AC4); granted → **the fetch spy sees the *flushed* beacon dispatched as a GET to
   `facebook.com/tr`** (the exact `:176`→`:363` path, asserted end-to-end, not just that `:363` is method-aware);
   denied + strict → dropped. (Exercises `airlock.js:163` — the consent path RUM skips.)
7. **Seal binds — endpoint-confined.** The beacon is confined to `facebook.com` by the **host** ceiling
   (`airlock.js:194`); a config naming an outside endpoint **cannot widen egress** (advisory manifest endpoints,
   `connector.d.ts:129`).
8. **No PII in the query string.** The connector serializes **only governed `event.params`** into the `/tr` query
   and injects **no un-governed `ctx` identity**. Proof: a field **explicitly wired into the Meta instance's
   `payloadDenylist`** (e.g. `email` — the built-in `DEFAULT_DENYLIST` is password/ssn/cvv/card, `airlock.js:59-67`,
   so `email` must be added, else the test is accidentally trivial) is present on the input event yet **provably
   absent** from the dispatched `/tr` URL — a *real strip*, not `email` never having entered params (the "no PII
   in URL params" property; input-side `governParams` strip).
9. **Identity honesty (scope).** The beacon carries **no identity** (`id` + `ev` + non-PII params) — basic
   `_fbp` / `fbc` cookie identity **and** advanced-matching `ud[...]` both **out of scope**; a test asserts
   neither leaks. Basic cookie identity → a follow-up (chamber cookie capability); advanced matching → 026-03.
10. **No GA4 mis-map to the ad endpoint (verdict-preservation completeness — frame-critique #2a + craft-review).**
    A pixel-connector instance neither **wires** the GA4-`mapToMp` unload dispatcher (`airlock.js:277-280` gated on
    `connector !== "pixel"`) **nor routes `pushCritical` through it** (`pushCritical` early-returns + diagnoses for
    a pixel instance — the **SECOND** mis-map entry the frame-critique's enumeration missed, caught by the craft
    review). Both tests grant consent (`ad_storage: granted`) so the counterfactual actually fetches: a ring-resident
    pixel event at `pagehide`, and a `pushCritical` call, each emit **no GA4-shaped POST** to `facebook.com/tr` —
    the event is *dropped* (unload-loss deferred, bounded + disclosed; unload-critical GET dispatch for pixels is a
    later slice). GA4's own unload path **and** `pushCritical` are unchanged (regression tests).

**DoD:**
- [x] `createPixelConnector` + Meta config fixture + the selection seam + method-aware dispatch + adapter wiring,
      **TDD** (tests first).
- [x] All 10 ACs proven by **targeted** tests — map correctness (AC2), the selection seam + GA4 regression (AC3),
      the three-site method-aware dispatch + GA4 regression (AC4), the end-to-end GET (AC5), consent + GET-flush
      (AC6), endpoint-confinement (AC7), the no-PII **absence** proof (AC8), the no-identity-leak proof (AC9), and
      the no-GA4-mis-map-at-unload proof (AC10).
- [x] **The core change is bounded + generally-useful + verdict-preserving — honestly enumerated:** a close-out
      diff note listing **exactly** the core sites touched — `core/airlock.js` `:149` (init-message
      generalization), `:176` (held record captures `method`), `:201` + `:363` (method-aware dispatch), `:277-280`
      (conditional unload wiring) + a new `core/pixel-chamber.worker.js`; `core/airlock.js:118` and
      `core/egress.js` left **unchanged** (`:118` still constructs `critical` — the minimal neutralization gates
      only the unload wiring, avoiding null-guards; `egress.js` neutralized by not-wiring) — plus a GA4
      **regression test** proving the seal's governance verdicts, GA4's POST dispatch, **and** GA4's unload path
      are all unchanged. (This replaces the withdrawn "zero core changes" AC — honest, since the frame-critique
      proved that false; the surface is larger than the first reframe claimed, and now fully named.) See
      "Core-change diff note" below.
- [x] **No live identifiers** (synthetic pixel id; public documented endpoint; no live beacon — assert on the
      dispatch spy).
- [x] `npm run lint` clean; **targeted** vitest green (not the hanging full suite).
- [x] **Frame-critique RE-PASS recorded** (this reframe cleared the pass the first draft failed) — see
      `reviews/slice-01-frame-critique.md` (PASS on the 3rd revision).
- [x] Close-out: `### Reconciliation sweep` + `### Deviation log`; promote the config-contract + the
      method-aware-dispatch / selection-seam learnings toward 026-02 (+ the identity/cookie follow-up).

**Anti-horizontal-phasing check:** 026-01 is **vertical** — a real site can route Meta Pixel through airlock via a
config and a **real governed `/tr` GET is dispatched** (consent-held / endpoint-confined / PII-stripped). The two
core seams (selection + method-aware dispatch) are built **because this vendor needs them to ship**, not as
speculative infrastructure — and they are the minimal generalization that also unblocks every later 026 vendor.

### Core-change diff note

Exactly the sites named in the DoD's own honest enumeration, confirmed against the landed implementation — no
more, no less:

- `core/airlock.js` — new `fetchInit(method, body)` helper (the shared implementation for the two method-aware
  dispatch call sites below); the `connector`/`connectorConfig` constructor options; the worker-construction +
  init-message block (was `:148-149`, GA4-shaped `{trackers, workFactor, endpoints, ctx}`) now branches on
  `connector === "pixel"` — GA4's literal `new Worker(new URL("./chamber.worker.js", …))` call stays FIRST in
  source order (load-bearing for `build.mjs`'s own bundle-layout assertion, which greps the emitted bundle for
  the first `new Worker(new URL("…"` literal — see the Deviation log); the held-beacon record (was `:176`) now
  captures `method`; the steady-state dispatch (was `:201`) and the `setConsent` flush (was `:363`) both route
  through `fetchInit`; the unload-listener registration (was `:277-280`) is now gated on `connector !== "pixel"`;
  **and (craft-review) `pushCritical` early-returns + diagnoses for a pixel instance** — the second mis-map entry
  the unload-wiring gate alone did not close (it routes through the same GA4 `critical` dispatcher).
- `core/airlock.js:118`'s `critical = createCriticalDispatcher(…)` — **left unchanged**, still constructs
  unconditionally for every connector (no null-guards needed at `stats()`/`pushCritical()`; `pushCritical` is
  neutralized by its own connector guard, not by dropping the construction).
- `core/egress.js` — **left unchanged** (neutralized for a pixel instance purely by the two connector guards
  above, never invoked).
- `core/pixel-chamber.worker.js` — **new file**, mirroring `core/chamber.worker.js` (including its first-import
  egress-confinement guard) — swaps the hosted factory to `createPixelConnector`, drops the GA4-shaped init fields.
- `core/confine-pixel-chamber.js` — **new file (craft-review — security parity for an ad-vendor chamber)**,
  mirroring `core/confine-ga4-chamber.js`: `applyEgressConfinement(self, { withholdFetch: true })` as the pixel
  chamber's FIRST import. Source-order + withholdFetch regression-pinned in `test/egress-confinement.test.js`.
- GA4 regression proof: co-located in `test/pixel-seam.test.js` (one focused assertion per touched site, tagged
  `REGRESSION`) **and** the full pre-existing GA4/adapter test suite (`consent-seal`, `endpoint-ceiling-seam`,
  `chamber-observability`, `airlock-dispose`, `egress-fastpath`, `ga4-connector`, `ga4-map`, `ga4-consent`,
  `ga4-cookies`, `ga4-purchase`, `chamber-isolation`, `connector-host`, `eds-boot`, `eds-interactions`,
  `eds-exposure`, `eds-blocks`, `eds-cookies`, `eds-dom-reserve`, `helix-rum-seam`, `helix-rum-connector`,
  `helix-rum-cwv`, `push-contract`, `payload-governance(-seam)`, `endpoint-ceiling`, `consent`,
  `contract-stability`, `core-boundary`, `egress-confinement`, `generic-capture`) re-run unmodified and green.

### Deviation log

- **The declarative `paramMap` entry shape (`{ from: "static" | "event" | "params", … }`) is this slice's own
  design choice, not pinned by the spec text.** AC1 names the config's top-level shape
  (`{ endpoint, eventMap, paramMap }`) but not `paramMap`'s per-entry vocabulary. A three-source tag (a static
  literal, the event-mapped name, or a projected `event.params` field) is the minimal interpreter Meta's `/tr`
  needs — it is also what lets the `id`/`ev` query-key NAMES themselves be config-supplied rather than hardcoded
  in the connector (proven by `test/pixel-connector.test.js`'s unrelated fake-vendor-config case). Named
  explicitly because 026-02 (2-3 more vendors, including a POST-body one) is where this vocabulary gets stressed
  — the residual bet the parent spec already flags ("is a *data* map expressive enough… without a code escape?").
- **`adapters/eds/index.js` gained a real `bootMetaPixel()` function, not just a re-exported constant.** AC6 says
  "a matching `egressPurposes` wired for Meta **in the adapter**" — read literally (mirroring how
  `GA4_EGRESS_PURPOSES` is wired inside `bootEdsAnalytics`, not just exported), so a genuine adapter-level boot
  function was added (`test/eds-meta-pixel.test.js`), deliberately MINIMAL relative to `bootEdsAnalytics`: no
  cookie-sourced `ctx` (this connector reads none, by design), no `wireInteractions`/`wireExposure`/`wireBlocks`,
  no `window` global slot, and no `pushCritical` on the returned handle. (Post craft-review this is now
  **belt-and-suspenders**: the core `pushCritical` itself early-returns + diagnoses for a pixel instance, so the
  adapter omission is defense-in-depth, not the sole guard against the GA4-`critical`-dispatcher mis-map.)
- **~~`core/pixel-chamber.worker.js` has no egress-confinement first-import guard~~ — RESOLVED (craft-review).**
  The craft review judged deferring a one-line security-parity control for an *ad-vendor* egress chamber a
  questionable scope call. Built: `core/confine-pixel-chamber.js` (`applyEgressConfinement(self,
  { withholdFetch: true })`) is now `pixel-chamber.worker.js`'s **first import**, mirroring
  `core/confine-ga4-chamber.js` — the pixel connector's egress is the `ready` postMessage, not a mediated worker
  fetch, so the `withholdFetch: true` inversion applies verbatim. Source-order + withholdFetch regression-pinned
  in `test/egress-confinement.test.js`. (A future slice may fold both `confine-*-chamber.js` modules into one
  shared `confine-chamber.js` — 026-02.)
- **`build.mjs` was not updated to add `core/pixel-chamber.worker.js` as a third bundle entry point.** The
  connector-selection seam (AC3) is proven at the Node/vitest runtime level (FakeWorker-driven) and confirmed not
  to break `build.mjs`'s existing bundle-layout assertion (re-run after landing — see below); but a REAL EDS page
  calling `createAirlock({ connector: "pixel", … })` today would 404 fetching the worker file, since it is not
  yet emitted alongside `chamber.worker.js`/`eds.js`. This is a genuine gap before a real deployment, out of this
  slice's DoD-named scope (not listed among the touched core sites) — flagged for a follow-up (parked below).
- **Self-caught build-gate bug, fixed before reporting done.** The first implementation of the two
  `new Worker(new URL(…))` call sites used a ternary with the pixel branch as the `?` consequent (textually
  FIRST in source), the opposite of the intended "GA4's literal stays first" ordering — `npm run build` (run as
  an extra, cheap, side-effect-free sanity check beyond the targeted vitest files, since it directly exercises
  the load-bearing literal-first assumption) caught it immediately via `build.mjs`'s own bundle-layout assertion
  (`worker specifier is "./pixel-chamber.worker.js", expected "./chamber.worker.js"`); fixed by flipping the
  ternary's condition (`connector !== "pixel" ? <ga4> : <pixel>`), re-verified both by `npm run build` passing
  and by re-running the full pixel/GA4 targeted test set (behavior is unaffected — a pure condition-flip).
- **AC4's `:176` "method captured" claim is proven indirectly**, via the held-GET-flushes-as-GET test's success
  (not a direct unit read of the private `heldBeacons` closure array, which the seam's own public surface never
  exposes) — the SAME indirect-proof pattern `test/consent-seal.test.js` already uses for the pre-existing
  `:176`→`:363` pairing, so this is not a new testing gap this slice introduced.
- **Craft-review remediation round (post-implementation gating reviews — compliance PASS, craft NEEDS-CHANGES →
  resolved).** Both independent reviews converged on one gap the frame-critique's own enumeration missed:
  `pushCritical` is a **second** raw-`createAirlock`-handle entry into the GA4 `critical` dispatcher, so on a pixel
  instance it would GA4-map + POST to `facebook.com/tr` — the exact mis-map AC10 neutralizes on the unload path.
  Fixed (craft **blocker**): `pushCritical` early-returns + diagnoses for a pixel instance (a *core* guard, not
  merely the adapter omission); AC10 reworded to "no GA4 mis-map to the ad endpoint," covering **both** entries,
  with a new `pushCritical` no-op test + a GA4 `pushCritical` regression. Fixed (craft **causality nit**): AC10's
  unload test now grants consent, so the sync/unload consent gate can no longer mask the `:277-280` wiring gate —
  the counterfactual (gate removed) genuinely fetches + fails. Pulled in (craft nit): the pixel-chamber
  egress-confinement guard (see the RESOLVED entry above). Re-verified: 20 `pixel-seam` + 11 `egress-confinement`
  tests green, full GA4/adapter suite unmodified + green, `npm run lint` clean.

### Reconciliation sweep

- **Question answered + Outcome set** (the slice's contract, post-reframe): Meta's `/tr` GET ships end-to-end
  through a genuinely declarative interpreter (`createPixelConnector` + the Meta config fixture), governed by the
  existing seal (consent-held/flushed-as-GET/dropped, endpoint-confined, PII-stripped, no identity leak), via the
  two bounded core generalizations the archetype needs (the connector-selection seam + method-aware dispatch,
  three sites) — resolving OQ10 for the GET case. GA4's own verdicts, POST dispatch, and unload path are proven
  unchanged by co-located regression tests plus the full pre-existing GA4/adapter suite, unmodified and green.
- **Promoted, no orphans:** the config-contract learning (the `paramMap` `from`-tagged vocabulary, and where it
  might need a code-escape hatch) and the selection-seam/method-aware-dispatch learnings (the literal-first
  `new Worker(new URL(…))` build-gate constraint) both belong to 026-02's grounding, which should cite this
  slice directly rather than re-derive them. The basic first-party cookie identity (`_fbp`/`fbc`) follow-up named
  in the slice's own "Identity honesty" framing, and the one remaining out-of-DoD-scope residual (`build.mjs`'s
  missing third bundle entry point), are parked in `docs/inbox.md` rather than left only in this file. (The pixel
  chamber's egress-confinement guard, previously parked, was **built** in the craft-review round — see the
  Deviation log.)
- **Downstream named:** 026-02 (2-3 more vendors as configs, including one POST-body vendor, stress-testing the
  `paramMap` vocabulary's generality). **Explicit extension point for 026-02 (both reviewers):** the interpreter
  hardcodes `method: "GET"` with no body vocabulary (`connectors/pixel/connector.js`), so a POST-body vendor is
  the first code-escape — but a **clean, non-breaking** one, since `fetchInit` already honors `EgressRequest.method`;
  026-02's grounding should **cite this slice** for the `method`/body extension rather than re-derive it. 026-03
  (the `PixelVendorConfig` type + advanced-matching/hashed-identity);
  the basic-cookie-identity follow-up (a chamber cookie-capability question); the remaining `build.mjs` inbox
  item. No dependency left dangling.
- **No live identifiers, no probe code, no new dependency** committed — synthetic pixel id
  (`000000000000000`), the real public `facebook.com/tr` documented endpoint, every assertion against a `fetch`
  spy (never a live network call).
