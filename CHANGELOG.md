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

- _Nothing yet — MVP7 (Pixel Parity & the Parity Harness) is next; see [docs/releases/README.md](docs/releases/README.md)._

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
