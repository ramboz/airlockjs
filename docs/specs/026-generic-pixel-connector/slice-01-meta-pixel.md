---
status: DRAFT
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
10. **No GA4 mis-map at unload (verdict-preservation completeness — frame-critique #2a).** A pixel-connector
    instance does **not** wire the GA4-`mapToMp` unload dispatcher (`airlock.js:277-280` is connector-conditional).
    Test: a pixel event still ring-resident when the tab hides (`visibilitychange` / `pagehide`) is **not**
    mapped-and-POSTed to `facebook.com/tr` — the fetch spy sees **no GA4-shaped POST** on the unload path for a
    pixel instance (the event is *dropped* — unload-loss deferred, bounded + disclosed; unload-critical GET
    dispatch for pixels is a later slice). GA4's own unload path is unchanged (regression test).

**DoD:**
- [ ] `createPixelConnector` + Meta config fixture + the selection seam + method-aware dispatch + adapter wiring,
      **TDD** (tests first).
- [ ] All 10 ACs proven by **targeted** tests — map correctness (AC2), the selection seam + GA4 regression (AC3),
      the three-site method-aware dispatch + GA4 regression (AC4), the end-to-end GET (AC5), consent + GET-flush
      (AC6), endpoint-confinement (AC7), the no-PII **absence** proof (AC8), the no-identity-leak proof (AC9), and
      the no-GA4-mis-map-at-unload proof (AC10).
- [ ] **The core change is bounded + generally-useful + verdict-preserving — honestly enumerated:** a close-out
      diff note listing **exactly** the core sites touched — `core/airlock.js` `:149` (init-message
      generalization), `:176` (held record captures `method`), `:201` + `:363` (method-aware dispatch), `:277-280`
      (conditional unload wiring) + a new `core/pixel-chamber.worker.js`; `core/airlock.js:118` and
      `core/egress.js` left **unchanged** (`:118` still constructs `critical` — the minimal neutralization gates
      only the unload wiring, avoiding null-guards; `egress.js` neutralized by not-wiring) — plus a GA4
      **regression test** proving the seal's governance verdicts, GA4's POST dispatch, **and** GA4's unload path
      are all unchanged. (This replaces the withdrawn "zero core changes" AC — honest, since the frame-critique
      proved that false; the surface is larger than the first reframe claimed, and now fully named.)
- [ ] **No live identifiers** (synthetic pixel id; public documented endpoint; no live beacon — assert on the
      dispatch spy).
- [ ] `npm run lint` clean; **targeted** vitest green (not the hanging full suite).
- [ ] **Frame-critique RE-PASS recorded** (this reframe must clear the pass the first draft failed) before REVIEWED.
- [ ] Close-out: `### Reconciliation sweep` + `### Deviation log`; promote the config-contract + the
      method-aware-dispatch / selection-seam learnings toward 026-02 (+ the identity/cookie follow-up).

**Anti-horizontal-phasing check:** 026-01 is **vertical** — a real site can route Meta Pixel through airlock via a
config and a **real governed `/tr` GET is dispatched** (consent-held / endpoint-confined / PII-stripped). The two
core seams (selection + method-aware dispatch) are built **because this vendor needs them to ship**, not as
speculative infrastructure — and they are the minimal generalization that also unblocks every later 026 vendor.
