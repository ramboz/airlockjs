---
status: Proposed
dependencies: [adr-0015, adr-0017]
last_verified: 2026-09-18
frame_review: true
---

# ADR-0036: Per-site composition: registry boot, connector manifest, generator as a pure function

## Status

Proposed (2026-09-18)

## Context

Airlock's shipped dist tree is site-independent: every adopter vendors the same `eds.js` plus all eight chamber workers,
whether or not their config uses them. A GA4-only site therefore ships the Meta, Google Ads, Floodlight, alloy and RUM
main-thread glue and their worker files. For a runtime whose pitch is governed, least-privilege egress, unused vendor code
in the adopter's repo is noise at best and unaudited surface at worst, and the maintainer has rejected it outright
("a customer not using ga4 should not have the ga4 worker shipped to their repo").

Four grounded facts shape the decision:

1. **Workers are already spawned lazily, one per configured connector type.** `bootConnector`
   (`adapters/eds/index.js:2110-2165`) switches on `type` and only the booted connector constructs its `new Worker(...)`.
   Leaving an unused worker file out of a site tree is therefore safe at runtime today.
2. **The main bundle is a monolith.** `eds.js` (159 KB) statically imports every connector's main-thread glue
   (`adapters/eds/index.js:34-60`) and dispatches on a runtime `switch`, so esbuild cannot tree-shake it per config.
   The workers are the small part (9 to 16 KB each, 34 KB for the classic alloy chamber); the noise lives in `eds.js`.
3. **The build's own invariant blocks worker pruning.** `build.mjs` asserts that every worker sibling `eds.js` references
   exists in the emitted output, and documents that dropping one entry "seeds the AC3 missing-sibling regression". It also
   deliberately disables `splitting` so every entry is self-contained (`build.mjs:155`), and the blob/data/ajv scans and the
   same-origin-sibling assertion are written for that layout (the 004-01 CSP envelope).
4. **The connector library is four hand-synced lists.** The schema's `oneOf` (`contracts/instrumentation-config.schema.json`),
   `KNOWN_CONNECTOR_TYPES` (`adapters/eds/index.js:1950`), `WORKER_ENTRIES` / `CLASSIC_WORKER_ENTRIES` (`build.mjs`), and
   `DIST_ARTIFACTS` (`publish-dist.mjs:39`). There is no per-connector manifest a tool could read.

Two forces make this the moment to decide. The config builder (release plan
[config-builder](../releases/config-builder.md), [ADR-0037](./adr-0037-config-builder-hosting-github-write-path.md)) needs a
machine-readable connector library and a generator that turns a config into a site tree. And the config surface is still
"experimental / not-yet-frozen" with a follow-on freeze ADR parked in [refinement-todo](../refinement-todo.md) § Spec 032;
a per-site generator must be built against a frozen surface, so this ADR is that freeze's trigger.

Constraints inherited from earlier decisions: distribution stays git-subtree of a servable dist tree
([ADR-0015](./adr-0015-distribution-git-subtree.md)); the stable core's frozen API must not break
([ADR-0017](./adr-0017-airlock-1-0-api-contract.md)); workers stay same-origin file siblings with no `blob:`/`data:` and no
bundled ajv (spec 004-01 / 031).

## Decision Options Considered

### Option A: Status quo plus worker pruning only
The generator copies `eds.js` unchanged and omits unused worker files.
- **Pros:** No runtime change; smallest possible diff.
- **Cons:** Trips the build's sibling assertion (must be weakened, not honoured); `eds.js` still carries every connector's
  main-thread glue, so the noise the maintainer objects to remains. Does not produce a machine-readable connector library.

### Option B: Per-site esbuild at generation time
The generator writes a per-site entry importing only the chosen connectors and runs esbuild to emit one `eds.js` per site.
- **Pros:** Tightest output (one bundle, no shared chunks); keeps today's single-entry layout and all its assertions.
- **Cons:** Generation needs compute and the airlock sources wherever it runs. In a browser that means esbuild-wasm (tens of
  megabytes) plus a source bundle; otherwise a backend or a site-repo GitHub Action. The generator is no longer a pure
  function of config plus dist version, so CLI, UI and Action can diverge.

### Option C: Registry boot, per-connector manifest, generator as pure file selection
The runtime exposes a registry-injecting boot; each connector declares a manifest; dist is published so that a site tree is
a selection of published files plus a tiny generated entry.
- **Pros:** One manifest replaces four hand-synced lists and doubles as the builder's connector library. The generator is a
  pure function of (config, dist version, manifest) and runs identically in a CLI, in the browser, and in an Action. Adding
  a connector is one manifest entry; upgrading a site is a version-pin bump.
- **Cons:** Whether a pre-chunked dist satisfies the build invariants, and how much of `eds.js` is actually per-connector,
  are unverified (see R-013). A chunked layout adds a few same-origin requests post-LCP. The boot signature gains an
  additive form.

## Recommended Decision

Adopt **Option C for the composition model**, and leave the **output layout** (pre-chunked file selection versus an
Action-run bundle) open pending [R-013](../research/R-013-per-site-chunked-dist-feasibility.md). The decision is written so
either layout satisfies it.

1. **One manifest per connector is the single source of truth.** It declares the connector's `type` id, its schema
   definition, its main-thread module, its worker entry (module or classic), and its egress-purpose constant. The schema's
   `oneOf`, the known-type list, the worker entry list and the dist artifact list are derived from the manifests, or
   asserted equal to them at build time. Hand-synced copies are retired.
2. **Boot takes the connector set explicitly.** `boot(config, { connectors })` injects a registry built from the manifests
   the site ships. The full-registry `eds.js` is retained as the compatibility entry so the existing `boot(config)` call
   and ADR-0017's frozen surface are unchanged; the per-site form is additive.
3. **The generator is a pure function** from `(config, distVersion, manifests)` to a file set: the config as a committed
   file, a generated per-site entry that registers only the selected connectors, the selected dist artifacts, and the boot
   snippet for `scripts.js`. The CLI (`airlockjs init`), the config builder UI and any site-side Action call the same
   function.
4. **The config becomes a repo artifact** the generated entry loads, replacing the inline `window.__airlockConfig` global as
   the documented adoption form. The inline global remains valid for the compatibility entry.
5. **Output layout is decided by R-013.** If a pre-chunked dist (core plus one chunk per connector, paired with its worker)
   passes the CSP envelope and sibling assertions with acceptable request cost, the generator is file selection and needs
   no compute. If not, the generator emits the per-site entry and a site-repo Action runs esbuild; the registry, manifest
   and pure-function contract above hold either way.

## Consequences

**Becomes easier:**
- A site ships only the connectors it configured; "no GA4 in config, no GA4 bytes in the repo" is grep-provable.
- The config builder's connector picker and per-connector forms are generated from the manifests and the schema, with no
  separate registry to maintain.
- Adding a connector is one manifest entry plus its code; the four lists can no longer drift.
- Upgrades are a version-pin bump that regenerates the tree.

**Becomes harder:**
- Two entry forms to keep honest under the CSP envelope: the compatibility `eds.js` and the generated per-site entry.
- Existing adopters (the eds-testbed, the erp.intuit.com rewire from spec 050) must migrate from the inline global to the
  generated entry to get the pruning benefit; the compatibility entry keeps them working meanwhile.
- The adopter's repo carries more files (entry, config, selected artifacts) than one `eds.js` plus workers.
- The stable core gains an additive boot form that ADR-0017's freeze must now cover.

## Assumptions

- **Workers are spawned lazily per configured type.** Verified: `adapters/eds/index.js:2110-2165` and the alloy path at
  `:1588`.
- **`eds.js` is a 159 KB monolith with static imports of every connector.** Verified: `ls -la dist/` after `npm run
  build:dist` (2026-09-18) and `adapters/eds/index.js:34-60`.
- **A pruned worker set fails the build.** Verified from `build.mjs`'s documented invariant ("Dropping one seeds the AC3
  missing-sibling regression").
- **esbuild code splitting can be made to satisfy the blob/data/ajv scans and the same-origin-sibling assertion.**
  Unverified; the subject of R-013.
- **Per-connector main-thread glue is a meaningful fraction of `eds.js`.** Unverified; R-013 measures it with an esbuild
  metafile. If it is small, the chunked layout buys little and Option B's bundle step wins for the output layout.

## Kill criteria

- If R-013 shows a chunked dist cannot pass the CSP envelope, or that per-connector glue is a small fraction of `eds.js`,
  the chunked layout is dropped and the generator's output is bundled by a site-repo Action. The registry, manifest and
  pure-function decisions stand.
- If registry injection cannot be made additive to ADR-0017's frozen surface, this ADR is revisited before any spec is
  drafted.

## Open questions

- Chunked versus bundled output layout: R-013.
- Manifest form (JSON data versus a JS module exporting constants) and whether the schema is generated from manifests or
  asserted against them.
- Exact form of the committed config file (JSON with a loader, or a JS module exporting the object).
- Whether `helix-rum`'s governance-exempt status is expressed in its manifest or stays a boot-time carve-out.
