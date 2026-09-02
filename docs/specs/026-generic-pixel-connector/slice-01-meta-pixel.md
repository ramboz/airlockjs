---
status: DRAFT
dependencies: []
last_verified: 2026-09-02
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 026-01 — Meta Pixel through the generic connector, governed (the archetype proof)

**Goal:** The cheapest **vertical** slice that proves the generic pixel-connector archetype: one real vendor —
**Meta Pixel**, its `facebook.com/tr` image-GET **wire form** — expressed as a **declarative config** (endpoint +
event-name map + param map) against a new vendor-neutral `createPixelConnector(config)`, routed through the
**existing** wire-protocol seam (`core/connector-host.js` in-chamber → `core/airlock.js` seal on dispatch) and
governed end-to-end, with **zero core changes**. This establishes the **declarative-map interpreter** — 026's
net-new machinery — on one vendor before 026-02 generalises it across vendors.

> **Wire form, not the SDK.** This fires the `/tr` beacon that `fbevents.js` emits under the hood — expressed
> directly as config — **without loading `fbevents.js`**. That is precisely what makes it a *wire-protocol*
> connector (the govern+schedule end-state) and **not** a worker-dom / wrapped-SDK job (spec 025). A pixel is a
> beacon, not a DOM-heavy tag.

**DoR (grounded 2026-09-02 — the archetype recon):**
- ✅ A wire-protocol connector is `handle(event) → EgressRequest[]`, hosted worker-side by
  `core/connector-host.js` (`createConnectorHost(factory, config)` → `{manifest, init, routeBatch}`); the seal
  binds on main-thread dispatch — consent gate (`core/airlock.js:163`, `if (egressPurposes.length)`), endpoint
  ceiling (`:194`, `if (ceiling.length)`), payload governance (`:73-85`, `governParams`). GA4
  (`connectors/ga4/connector.js` `createGa4Connector`, `connectors/ga4/map.js` `mapToMp`) is the exemplar.
- ✅ **The seal rides for free:** GA4's retrofit onto the generic host left `git diff core/airlock.js` empty
  (refinement-todo, spec 022). This slice adds a connector + a config + adapter wiring — **not** core changes.
- ✅ **Consent contrast grounded:** GA4 is consent-gated (`purposes.egress: ["analytics_storage"]` +
  `GA4_EGRESS_PURPOSES` wired in `adapters/eds/index.js`); RUM is deliberately **not** gated (`egress: []`, no
  `egressPurposes`). Meta Pixel is an **ad** vendor → consent-gated (`ad_storage`), exercising the consent path
  RUM skips.
- ✅ **Input-side PII strip grounded:** `governParams` strips the denylist from `event.params` **before** the
  chamber (ADR-0019) — so the connector serializes already-governed params. R-007 classifies Meta (Facebook)
  Pixel as a Pixel-class vendor (`R-007:35`).
- ⚠️ **The declarative-map interpreter does not exist** — `mapToMp`/`mapToRum` are bespoke code. This slice
  **builds** it. The unproven bet the frame-critique pressure-tests: is a *data* map expressive enough for one
  real vendor without a code escape hatch?
- ✅ Meta Pixel wire form is public + documented: `GET https://www.facebook.com/tr?id={pixelId}&ev={event}&…`
  (the 1×1 image beacon). **Synthetic pixel id only** — no live identifier committed; no beacon actually fired.

**Acceptance Criteria:**

1. **A vendor-neutral `createPixelConnector(config)` exists** at `connectors/pixel/connector.js` whose
   `handle(event)` produces `EgressRequest[]` by interpreting a **declarative config** — `{ endpoint, eventMap,
   paramMap }` plus manifest inputs (`name`, `purposes`, `endpoints`) — with **no vendor-specific code in the
   connector**. All Meta specifics live in a **config object** (the fixture), not in `connector.js`. `init` is a
   no-op (no SDK to boot), mirroring GA4.
2. **Meta Pixel maps correctly.** Given a `PageView` and one custom event (e.g. `Lead`), the connector emits the
   correct `https://www.facebook.com/tr` beacon(s): `id={synthetic pixelId}`, `ev={event name via eventMap}`,
   event params projected per the declarative `paramMap`, GET/1×1 shape. Asserted against the documented Meta
   pixel wire format — table-driven, so the assertion is on the *interpreter applied to config*, not hardcoded.
3. **The seal binds — consent-gated.** The manifest declares `purposes.egress: ["ad_storage"]`; a matching
   `egressPurposes` is wired for Meta in `adapters/eds/index.js`. Consent absent → the beacon is **held at the
   seal** (`heldBeacons`, not sent); consent granted → flushed on the pending→granted edge; consent denied under
   strict → dropped. (Exercises `core/airlock.js:163`.)
4. **The seal binds — endpoint-confined.** The beacon is confined to `facebook.com` by the **host** endpoint
   ceiling (`core/airlock.js:194`, origin+path match). A config that names an endpoint outside the host-allowed
   set **cannot widen egress** — the ceiling is host-authoritative; the connector's declared `endpoints` are
   advisory (`contracts/connector.d.ts:129`).
5. **No PII in the query string.** The connector serializes **only `event.params`** (already input-governed) into
   the `/tr` query string and injects **no un-governed identity from `ctx`**. Proof: a denylisted field (e.g.
   `email`) present on the input event is **provably absent** from the emitted `/tr` URL — the "no PII in URL
   params" property, grounded on the input-side strip.
6. **Zero core changes.** `git diff core/airlock.js core/connector-host.js` is **empty** for this slice. Changes
   are confined to `connectors/pixel/**`, the Meta wiring in `adapters/eds/index.js`, and tests.
7. **Scope-limited (honest).** Non-PII event params + the pixel id only. **Advanced matching** (hashed
   email/phone, the `ud[...]` fields) is explicitly **out of scope → 026-03** — and the connector must **not**
   silently pass raw identity (a test asserts an advanced-matching-shaped input does not leak).

**DoD (spike/slice close-out):**
- [ ] `createPixelConnector` + the Meta config fixture + adapter wiring, **TDD** (tests first, then implementation).
- [ ] All 7 ACs proven by targeted tests — the map correctness (AC2), the two seal bindings (AC3/AC4), the
      no-PII-in-URL **absence** proof (AC5/AC7), the **empty core diff** (AC6).
- [ ] **No live identifiers** — synthetic Meta pixel id; `facebook.com/tr` is the public documented endpoint;
      no beacon is actually fired in tests (asserted on the built `EgressRequest`, not the network).
- [ ] `npm run lint` clean; **targeted** vitest green (not the hanging full suite — run the pixel test files).
- [ ] **Frame-critique pass recorded** (`frame_review: true`) before REVIEWED — the adversarial pass on the
      "declarative map is expressive enough / the governance story is airtight" framing.
- [ ] Close-out: `### Reconciliation sweep` + `### Deviation log`; promote the config-contract shape learnings
      toward 026-02 (what varied) / 026-03 (the identity surface).

**Anti-horizontal-phasing check:** 026-01 delivers **end-to-end** value — a site can route Meta Pixel through
airlock via a config, governed at the seal (consent-held / endpoint-confined / PII-stripped beacon out). It
touches the connector (new), the adapter (wiring), and the governed egress (the user-facing outcome) — not a
config-only or parser-only horizontal sliver. The declarative-map interpreter is built **because** this vendor
needs it, not as speculative infrastructure ahead of a user.
