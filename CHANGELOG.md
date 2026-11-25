# Changelog

All notable changes to **airlockjs** are documented here (format loosely follows
[Keep a Changelog](https://keepachangelog.com/)).

Two tag families:

- **`vX.Y.Z`** — source releases (this repo; the `package.json` version).
- **`dist-vX.Y.Z`** — the git-subtree-consumable **distribution** cut of a source release: a
  dist-rooted tree (`eds.js` + the four `*.worker.js` bundles + `VERSION`) that an EDS site
  vendors with `git subtree add`/`pull --prefix scripts/airlock airlock dist-vX.Y.Z --squash`.
  See [ADR-0015](docs/decisions/adr-0015-distribution-git-subtree.md) and the README.

## [Unreleased]

- `fix(adobe)`: first-push query edge cases match stock 2.31.1 (064-32). A non-empty `personalization.surfaces` array queries even when stock drops every entry; an empty-string or `[null]` scope entry queries, and a non-string entry other than `null`, a non-array value or a repeated entry is rejected; an explicit `defaultPersonalizationEnabled: true` also makes a notification-shaped push a query by Alloy as in stock; a `decisioning.proposition*` push that passes scopes or surfaces is a query; a push called before an `applyResponse` runs cold even if the apply finishes first (for the host cache and the declared scopes; a boot with no placement scopes still differs, see the slice Findings). This reverses 064-21: non-string surfaces are no longer dropped and repeated scopes are no longer deduped, both go to Alloy as given. Adopters: an earlier `applyResponse` spends the declared placement scopes. The owner approved correcting the slice's first criterion to match stock (a cache-only answer applies to empty or absent surfaces only).
- `fix(adobe)`: the Alloy chamber shim posts `fetch` and `navigator.sendBeacon` calls to the bridge in the order the tag made them (bug 007). A Blob-bodied beacon was posted only after its async `Blob.text()` read, so a later `fetch` could overtake it; the shim now holds later posts behind a pending Blob read (no wait on network responses). Consent and egress policy are unchanged: the seal still decides at main dispatch. A failed read still posts the beacon (empty body) and releases later calls.
- `feat(adobe)`: stock Adobe consent path (ADR-0064, 064-30): `handle.setAdobeConsent`, `thirdPartyCookiesEnabled` boot option.
- `feat(adobe)`: the Airlock martech library (ADR-0065, 069-03, DONE with 069-05's real-Chromium display-flow proofs and reviews, after the owner accepted AC8 on 2026-11-23): `adapters/eds/martech.js` exports the `aem-martech` API (`initMartech`, `sendEvent`, `updateUserConsent`, `martechEager`/`Lazy`/`Delayed`, ...) plus `getAirlockHandle`, on the `bootAlloy` handle with no `window.alloy` and no ACDL; consent goes through `setAdobeConsent` only; `THIRD_PARTY_NOTICES.md` credits `adobe-rnd/aem-martech` (Apache-2.0).
- `feat(adobe)`: the `bootAlloy` handle returns what stock Alloy returns (ADR-0065, 069-01): `handle.sendEvent` resolves `{ propositions, decisions }`, `applyPropositions({ viewName })`, a settling `handle.setAdobeConsent`, and a shared `onBeforeEventSend` helper (a throwing hook rejects like stock). `applyPropositions({ viewName })` differs from stock 2.31.1, which is a no-op for the bare form: the difference is the handle and the library, which render the cached view, not the stock-shaped wrapper, which matches stock and renders nothing.
- `feat(adobe)`: Airlock's generic data layer and an opt-in `adobeDataLayer` migration proxy (ADR-0065, 069-02): `adapters/eds/martech-datalayer.js` (`createDataLayer`, O(1) `push`, lazy deep-merge `getState`, no page global by default, functions never executed, optional forward to core); no `core/` change.
- `fix(adobe)`: an opt-out in flight for a superseded consent update still forwards (064-34): the adapter keeps a registration generation per consent update until a request carrying its consent leaves (that generation and older ones are consumed; a failed, non-ok, body-rejected or host-timed-out request puts its own generation back, using the 068-04 `onTimeout` hook); adds a gating real-Chromium wire check in `browser-oracle`.
- `feat(adobe)`: the opt-out forward carries only the consent the page gave (064-33): the adapter registers the page's Adobe 2.0 object and the vector-shaped consent through `host.expectOptOutConsent`.
- The wrapped-SDK host calls the optional `caps.egress.onTimeout(req)` when its own timeout answers a still-pending dispatch (spec 068-04).
- The Alloy opt-out forward now checks the `consent` it carries: the host method `expectOptOutConsent` registers the expected value and anything else is held; a refusal held while pending is dropped, not parked (spec 068-03, ADR-0062 amendment).

## [0.8.0] — 2026-09-14 — MVP8 (Ad-Conversion Offloading)

The ad-conversion tags that carry ~two-thirds of the reference site's martech TBT are now rewired off-thread,
consent-gated, and parity-confirmed — plus the OneTrust consent-input driver the reference site's CMP needs. Scope is the
**page-load** ad-beacon family; the true conversion ping (enhanced-match) + console-level attribution are MVP9.

### Added

- **The Google Ads (AW) ad-conversion connector** (spec 044, MVP8): `connectors/google-ads/` reproduces the AW page-load
  `www.google.com/ccm/collect` remarketing beacon off-thread, carrying Consent Mode v2 (`gcs`/`gcd`/`npa`) + a read-only
  host-sourced `_gcl_au`→`auid` (never minted, §A5), parity-confirmed by the 038 harness. Under `ad_storage`-denied it
  holds at the seal and re-maps on grant (no cookieless AW send), via the connector's `holdOnDenied` opt-in (044-02).
- **The Floodlight (DoubleClick / DC) ad-conversion connector** (spec 046, MVP8): `connectors/floodlight/` reproduces
  DC's two page-load beacons off-thread — the query-delimited `www.google.com/ccm/collect` and the `;`-delimited
  matrix-path `ad.doubleclick.net/activity;src=…` (Floodlight-native `src`/`type`/`cat` + `auiddc`) — both carrying
  Consent Mode v2 + a read-only `_gcl_au`-derived linker (never minted), parity-confirmed by the 038 harness. Under
  `ad_storage`-denied both hold at the seal and re-map on grant (no cookieless DC send).
- **The OneTrust consent-input driver** (spec 047 / [ADR-0026](docs/decisions/adr-0026-onetrust-consent-input-source.md)):
  a host-neutral, zero-import pure leaf reading OneTrust's **resolved** surface (`OnetrustActiveGroups` — never
  `GetDomainData().Status`, which is configured-default) and mapping the site's groups → the `core/consent.js` vector via
  a host-provided `{ groupId: purpose[] }` map. Subscribes OneTrust's consent-CHANGE signal (`OnConsentChanged` /
  `OptanonWrapper`) → `setConsent`, so a mid-session accept flushes 045-held ad beacons (047-02).
- **Ad-connector boot wiring + `onetrust` as a `boot(config)` composite governance field** (spec 048 /
  [ADR-0027](docs/decisions/adr-0027-onetrust-composite-governance-field.md)): `bootGoogleAds` / `bootFloodlight` +
  declarative `{type:"google-ads"|"floodlight"}` config + composite membership, each hosted in an egress-confined worker
  chamber. `onetrust` is promoted to a top-level composite governance field wired to the `setConsent` fan-out (the
  composite is the SOLE subscriber by construction), so a mid-session OneTrust **accept flushes held Google Ads AND
  Floodlight beacons end-to-end through the real composite**.
- **Seal hold-until-granted + fan-out re-map** (spec 045 / [ADR-0023](docs/decisions/adr-0023-ad-pzn-egress-hold-until-consent.md),
  045-03 / [ADR-0024](docs/decisions/adr-0024-fanout-remap-per-beacon-key.md)): `holdOnDenied` buffers a denied-purpose
  beacon and re-maps it under the now-current consent on the grant edge; a per-beacon `EgressRequest.remapKey` lets a
  connector that fans one event out to N held beacons re-map **each** to its own form (the 1:1 seal could not); 1:1
  connectors are byte-unchanged.
- **Endpoint-ceiling matrix-URI granularity** (spec 046-02 / [ADR-0025](docs/decisions/adr-0025-endpoint-ceiling-matrix-prefix-match.md)):
  a declared `;`-matrix path opts into a segment-anchored prefix match (admitting a per-request path cachebuster); exact
  match preserved for every query-delimited endpoint.

### Changed

- **Manifest vocabulary is a single source of truth.** Each connector exports its `events` / `purposes.egress`
  vocabulary (`GA4_EVENTS`, `GOOGLE_ADS_EGRESS_PURPOSES`, …) as a frozen const the manifest AND `adapters/eds/index.js`
  share by reference — retiring the adapter's hand-maintained `*_MANIFEST_EVENTS` / `*_EGRESS_PURPOSES` mirror consts (a
  reference-identity guard test makes drift impossible).
- **`boot(config)` rejects unknown top-level config keys** (loud + actionable, surfacing the known set), matching the
  pinned schema's `additionalProperties:false` — and making the schema↔runtime governance-field cross-check two-sided.

### Fixed

- **A re-`boot()` no longer strands the composite's held OneTrust-gated beacons**
  ([ADR-0028](docs/decisions/adr-0028-onetrust-unsubscribe-reboot-safety.md)): `subscribeOnetrustConsentChanges` grows an
  idempotent, compare-and-clear `unsubscribe()` (a stable trampoline over a mutable active-handler slot), folded into
  `dispose()` — so a re-boot's new subscription takes the surface over without the prior teardown stranding it.

## [0.7.0] — 2026-09-11 — MVP7 (Pixel Parity & the Parity Harness)

### Added

- **The vendor-generic parity harness** (spec 038 / [ADR-0020](docs/decisions/adr-0020-parity-contract-anti-drift.md)):
  capture → replay → per-protocol semantic oracle → report, confirming a rewired tag reaches the vendor boundary with
  the same attribution-bearing fields its tag-manager container carried. Per-field gap ownership,
  drift-as-regression-guard, and hard-gap owner-re-decision are the enforced parity contract. Meta advanced-matching
  `ud[external_id]` **field-presence** parity is confirmed (038-04, via redact-both-sides); GA4 rides the same engine.
- **The generic pixel connector** (spec 026): one config-driven `createPixelConnector` interpreting a declarative
  `PixelVendorConfig` — Meta / LinkedIn / Bing as pure configs on the GET `/tr` wire shape, governed end-to-end.
  **Meta advanced matching** (026-04 / [ADR-0022](docs/decisions/adr-0022-pixel-advanced-matching-hashing.md)): the
  egress-confined worker normalizes + SHA-256-hashes `ud[external_id]` + `ud[em]`/`ph`/… eagerly and posts only the
  hash back to a main-thread hash-only cache; a dedicated `setIdentity`/`init` channel feeds raw PII to in-chamber
  hashing (bypassing `push()` governance by design, safe under egress confinement). Only hashes egress.
- **The GA4 gtag-protocol connector** (spec 039 / [ADR-0019](docs/decisions/adr-0019-ga4-gtag-protocol-connector.md)):
  an additive off-thread `/g/collect` connector carrying Consent-Mode `gcs`/`gcd` + `_ga_<stream>` session-state,
  coalescing same-context bursts into gtag's batched `/g/collect` POST (spec 040).
- **The GET-critical unload dispatcher** (spec 042): `createCriticalDispatcher`'s `requestMapper` GET path flushes a
  worker-mapped GET connector's ring tail at page teardown (pixel `/tr` + ga4-gtag `/g/collect`), retiring the
  `workerMappedGetEgress` drop-gate.

### Changed

- **`setIdentity(raw)`** — an additive, pixel-only method on the frozen stable core (ADR-0017 permits additive,
  non-breaking extensions), present only on an advanced-matching-capable pixel boot handle (Meta today); pinned in
  `test/contract-stability.test.js`.

**Distribution:** **`dist-v0.7.0`** — the git-subtree cut of the v0.7.0 runtime, byte-pinned to the `v0.7.0` source tag.

## [0.6.0] — 2026-09-07 — MVP6 (Stable Core & Validation Harness)

### Added

- **The stable-core API contract** (spec 037 / [ADR-0017](docs/decisions/adr-0017-airlock-1-0-api-contract.md)):
  the five contract surfaces (GA4 MP, `push()`, connector interface, capability API, seam drivers) + the adopter
  boot layer are **frozen and enforced** (`test/contract-stability.test.js`); the instrumentation-config schema
  stays an explicit experimental carve-out.
- **Distribution channel** (spec 031 / [ADR-0015](docs/decisions/adr-0015-distribution-git-subtree.md)):
  airlock ships as ready-to-serve built artifacts over **git subtree** (npm deferred as the future
  bundler-audience channel). `npm run build:dist` emits `dist/`; `npm run publish:dist -- --target <t>
  --release` publishes a dist-rooted `dist` branch + an **immutable `dist-vX.Y.Z` tag**
  (`VERSION` == the tag by construction). Consume/update with `git subtree add`/`pull …
  dist-vX.Y.Z --squash` (overwritten wholesale — never hand-edit the vendored tree). Proven
  end-to-end by `npm run rig:subtree` (install + update paths, on a clean EDS checkout, CWV preserved).
- **Release wiring:** `npm run release:dist` cuts the `dist-vX.Y.Z` tag for the current version, and a
  `postversion` hook runs it so `npm version X.Y.Z` cuts the distribution tag automatically.
- **Name-scoped cookie-grant hardening** (spec 035): default-deny name-scope + RFC-6265 name-validation on
  **both** halves of the live alloy cookie grant (the boot-seed read filter and the write-back sink), so a
  chamber granted `kndctr_`/`AMCV_`/`demdex` can neither read nor write outside its declared names.
- **Real-site validation harness** (spec 036): the CWV before/after harness (`rig/lh-live.mjs`) + the
  supported-subset smoke (`rig/subset-smoke.mjs`) + the run procedure
  ([docs/real-site-validation.md](docs/real-site-validation.md)). The live run is the operator's creds-gated
  step (carried to MVP9). `reserveSpace` eager pre-paint production wiring landed via `reservePersonalization`
  (spec 033-03), closing OQ13/018-h.

### Changed

- **1.0 redefined** ([ADR-0018](docs/decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md), a reframe):
  1.0 now means *adoptable with confirmed parity* — a developer rewires a real intuit-class site's TBT-dominant
  generic vendor tags (GA4, Meta Pixel, Google Ads, Floodlight) onto airlock with vendor-boundary parity, cut at
  **MVP9** — **not** the API pin. ADR-0017's frozen surface is re-read as **"the stable core"** (contract
  unchanged). Release ladder re-scoped: MVP6 Stable Core → MVP7 Pixel Parity & the Parity Harness → MVP8
  Ad-Conversion Offloading → MVP9 Real-Site Rewire → **v1.0.0** (container translator post-1.0).

**Distribution:** **`dist-v0.6.0`** — the git-subtree cut of the v0.6.0 runtime (`eds.js` +
`reserve-personalization.js` + 5 worker siblings), byte-pinned to the `v0.6.0` source tag.

## [0.5.0] — 2026-09-03 — MVP5 (inspector + CWV scoreboard + RUM subsume)

- The **enforcement inspector** — why a beacon fired / held at the seal / was gated / stripped
  (spec 028); the before/after **CWV scoreboard** (spec 029); and airlock as the page's **governed
  RUM authority** + the page-side replace, no double-count (spec 030). A testbed proof, not a
  real-site rollout.

**Distribution:** **`dist-v0.5.0`** — the git-subtree cut of the v0.5.0 runtime, byte-identical to the
`v0.5.0` source tag (the distribution channel landed after v0.5.0, so v0.5.0 is cut retroactively).

## [0.4.0] — 2026-09-03 — MVP4 (the core AEM stack)

- GA4 + governed Adobe/**alloy** + the **`helix-rum`** connector — the core of an AEM/Adobe site,
  running off-thread behind the airlock.

## [0.3.0] — 2026-08-31 — MVP3 (secured I/O seams)

- Turned the declared least-privilege shape into **enforced** least-privilege: config-integrity
  enforcement, endpoint-ceiling enforcement, the purpose-vector **consent** gate, and payload governance.

## [0.2.0] — 2026-08-29 — MVP2 (the wrapped-SDK archetype)

- The second connector archetype: a stock vendor SDK (**alloy**) runs isolated in a chamber;
  concurrent-chamber mint coalescing.

## [0.1.0] — 2026-08-28 — MVP1 (the runtime + wire-protocol archetype)

- The off-main-thread, capability-secured runtime and the **wire-protocol** connector archetype
  (GA4 via the Measurement Protocol), CWV-safe by construction; hermetic + browser CI.
